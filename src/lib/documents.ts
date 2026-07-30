import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  checkClaim,
  extensionOf,
  formatBytes,
  sniffFileType,
  storagePathFor,
  type FileClaim,
} from "@/lib/uploads";

/**
 * Storage and bookkeeping for uploaded documents.
 *
 * Uploads do not pass through this server. The browser asks for a signed
 * upload URL per file, sends the bytes straight to Supabase, and then asks
 * us to confirm what landed.
 *
 * That shape is not a preference. Vercel caps a serverless request body at
 * 4.5MB, so ten files at up to 10MB each could not be posted to a server
 * action at all — the request would be refused before any of our code ran.
 * Going direct also means a big upload on a phone tether isn't paying for a
 * function invocation while it crawls.
 *
 * What it costs is that validation has to happen twice, in two places, for
 * two different reasons:
 *
 *  - before signing, against what the browser *claims* about each file. This
 *    is cheap and catches honest mistakes, and none of it is trusted.
 *  - after upload, against the bytes that actually arrived. This is the one
 *    that decides. A file is downloaded back, its leading bytes are sniffed,
 *    and anything that isn't what it said it was is deleted from storage
 *    rather than recorded.
 *
 * The bucket's own `allowed_mime_types` and `file_size_limit` sit underneath
 * both as a floor the client cannot talk past.
 */

export const BUCKET = "submission-documents";

/** How long a read URL lives. Long enough to open, short enough to be useless if it leaks. */
export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export type UploadSlot = {
  path: string;
  signedUrl: string;
  token: string;
  fileName: string;
};

export type SlotRequest =
  | { ok: true; slots: UploadSlot[] }
  | { ok: false; error: string };

/**
 * Validates a batch of claimed files and mints one signed upload URL each.
 *
 * A signed upload URL is a capability for exactly one object path, so a
 * caller cannot use it to write anywhere else in the bucket, overwrite
 * someone else's file, or read anything at all.
 */
export async function requestUploadSlots(
  submissionId: string,
  claims: FileClaim[],
): Promise<SlotRequest> {
  if (claims.length === 0) {
    return { ok: false, error: "No files were selected." };
  }

  if (claims.length > MAX_FILES) {
    return {
      ok: false,
      error: `That's ${claims.length} files — ${MAX_FILES} is the most we take at once.`,
    };
  }

  const total = claims.reduce((sum, claim) => sum + claim.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: `That's ${formatBytes(total)} altogether, over the ${formatBytes(MAX_TOTAL_BYTES)} limit.`,
    };
  }

  for (const claim of claims) {
    const check = checkClaim(claim);
    if (!check.ok) {
      return { ok: false, error: `${claim.name}: ${check.reason}.` };
    }
  }

  const supabase = getSupabaseAdminClient();
  const slots: UploadSlot[] = [];

  for (const [index, claim] of claims.entries()) {
    const path = storagePathFor(submissionId, index, extensionOf(claim.name));

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      // Anything already signed in this batch is abandoned rather than
      // cleaned up: nothing has been written to those paths, so there is
      // nothing there to remove.
      console.error("Could not create a signed upload URL:", error?.message);
      return {
        ok: false,
        error: "We couldn't start the upload. Try again in a moment.",
      };
    }

    slots.push({
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
      fileName: claim.name,
    });
  }

  return { ok: true, slots };
}

export type ConfirmedDocument = {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
  duplicateOf?: string;
  versionGroupId?: string;
  versionN?: number;
  supersedesDocumentId?: string;
};

export type ConfirmResult = {
  accepted: ConfirmedDocument[];
  rejected: { fileName: string; reason: string }[];
};

/**
 * Checks what actually landed, records the good ones, deletes the rest.
 *
 * Every path is verified against the submission it claims to belong to
 * before anything is read, so a caller cannot get us to adopt an object
 * sitting under someone else's submission by naming its path.
 */
export async function confirmUploads(
  submissionId: string,
  uploaded: { path: string; fileName: string }[],
): Promise<ConfirmResult> {
  const supabase = getSupabaseAdminClient();
  const accepted: ConfirmedDocument[] = [];
  const toInsert: ConfirmedDocument[] = [];
  const rejected: ConfirmResult["rejected"] = [];

  for (const { path, fileName } of uploaded) {
    // Paths are minted as `<submissionId>/...`, so anything else is either a
    // bug or someone probing. Neither gets read.
    if (!path.startsWith(`${submissionId}/`)) {
      console.warn(`Refusing to confirm an out-of-scope upload path: ${path}`);
      rejected.push({ fileName, reason: "we couldn't verify that upload" });
      continue;
    }

    const { data, error } = await supabase.storage.from(BUCKET).download(path);

    if (error || !data) {
      rejected.push({ fileName, reason: "it didn't finish uploading" });
      continue;
    }

    const bytes = new Uint8Array(await data.arrayBuffer());

    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
      await removeObjects([path]);
      rejected.push({ fileName, reason: "it was empty or too large" });
      continue;
    }

    // The decisive check. What it says it is does not matter here; what its
    // first bytes say it is does.
    const sniffed = sniffFileType(bytes, fileName);

    if (!sniffed) {
      await removeObjects([path]);
      rejected.push({
        fileName,
        reason: "it isn't a document or photo we can read",
      });
      continue;
    }

    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const { data: duplicate } = await supabase
      .from("submission_documents")
      .select("id, storage_path")
      .eq("submission_id", submissionId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (duplicate) {
      await removeObjects([path]);
      accepted.push({
        path: duplicate.storage_path,
        fileName,
        mimeType: sniffed,
        sizeBytes: bytes.byteLength,
        contentHash,
        duplicateOf: duplicate.id,
      });
      continue;
    }

    const { data: previousVersion } = await supabase
      .from("submission_documents")
      .select("id, version_group_id, version_n")
      .eq("submission_id", submissionId)
      .eq("file_name", fileName)
      .order("version_n", { ascending: false })
      .limit(1)
      .maybeSingle();

    const confirmed = {
      path,
      fileName,
      mimeType: sniffed,
      sizeBytes: bytes.byteLength,
      contentHash,
      ...(previousVersion
        ? {
            versionGroupId: previousVersion.version_group_id,
            versionN: Number(previousVersion.version_n) + 1,
            supersedesDocumentId: previousVersion.id,
          }
        : {}),
    };
    accepted.push(confirmed);
    toInsert.push(confirmed);
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("submission_documents").insert(
      toInsert.map((document) => ({
        submission_id: submissionId,
        storage_path: document.path,
        file_name: document.fileName,
        mime_type: document.mimeType,
        detected_mime_type: document.mimeType,
        size_bytes: document.sizeBytes,
        content_hash: document.contentHash,
        ...(document.versionGroupId
          ? {
              version_group_id: document.versionGroupId,
              version_n: document.versionN,
              supersedes_document_id: document.supersedesDocumentId,
            }
          : {}),
      })),
    );

    if (error) {
      // The objects exist but nothing records them, which would leave files
      // in the bucket that no submission points at. Remove them rather than
      // leave orphans behind.
      console.error("Could not record uploaded documents:", error.message);
      await removeObjects(toInsert.map((document) => document.path));

      return {
        accepted: accepted.filter((document) => document.duplicateOf),
        rejected: toInsert.map((document) => ({
          fileName: document.fileName,
          reason: "we couldn't save it — try again, or send it by email",
        })),
      };
    }
  }

  return { accepted, rejected };
}

async function removeObjects(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);

  if (error) {
    console.error("Could not remove storage objects:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export type StoredDocument = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export async function listDocuments(
  submissionId: string,
): Promise<StoredDocument[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submission_documents")
    .select("id, storage_path, file_name, mime_type, size_bytes, created_at")
    .eq("submission_id", submissionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not list documents: ${error.message}`);

  return (data ?? []) as StoredDocument[];
}

/**
 * A short-lived read URL for one stored object.
 *
 * The only way to read anything out of this bucket. There are no public URLs
 * — the bucket is private, so an object path on its own grants nothing.
 */
export async function signedUrlFor(
  storagePath: string,
  expiresIn = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data) {
    console.error("Could not sign a document URL:", error?.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Downloads a stored object's bytes, server-side.
 *
 * Used by the analysis pipeline (task 027) to extract text. Deliberately
 * separate from signedUrlFor: reading a file to work on it should not
 * require minting a URL that could be passed to someone else.
 */
export async function readDocument(
  storagePath: string,
): Promise<Uint8Array | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !data) {
    console.error("Could not read a document:", error?.message);
    return null;
  }

  return new Uint8Array(await data.arrayBuffer());
}

export type DeleteReport = {
  submissionId: string;
  documentsRemoved: number;
  objectsRemoved: number;
  submissionDeleted: boolean;
};

/**
 * Hard-deletes a submission: its row, its document rows, and its files.
 *
 * This exists so a deletion request can actually be honoured. Someone who
 * uploaded their safety paperwork and then asks for it back is entitled to
 * have it gone, and "gone" has to mean the objects too — deleting the row
 * alone would leave the documents sitting in the bucket, which is the worst
 * of both worlds: unreachable through the product, and still there.
 *
 * Storage is emptied first and the row deleted second, on purpose. If this
 * fails halfway, the failure leaves a row pointing at files that are already
 * gone, which is recoverable and visible. The other order would leave files
 * nothing points at, which is not.
 *
 * Run it with: npm run delete-submission -- <id>
 */
export async function deleteSubmission(
  submissionId: string,
): Promise<DeleteReport> {
  const supabase = getSupabaseAdminClient();

  const documents = await listDocuments(submissionId);

  // Listed from the bucket as well as from the table. A file whose insert
  // failed, or whose row was lost, would otherwise survive a deletion
  // request — and that is precisely the file you cannot afford to keep.
  const { data: objects } = await supabase.storage
    .from(BUCKET)
    .list(submissionId);

  const paths = new Set<string>(documents.map((doc) => doc.storage_path));
  for (const object of objects ?? []) {
    paths.add(`${submissionId}/${object.name}`);
  }

  const objectsRemoved = await removeObjects([...paths]);

  const { error } = await supabase
    .from("submissions")
    .delete()
    .eq("id", submissionId);

  if (error) {
    throw new Error(`Could not delete submission ${submissionId}: ${error.message}`);
  }

  return {
    submissionId,
    documentsRemoved: documents.length,
    objectsRemoved,
    // The document rows go with it: the foreign key is ON DELETE CASCADE.
    submissionDeleted: true,
  };
}
