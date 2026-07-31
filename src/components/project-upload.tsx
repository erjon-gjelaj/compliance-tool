"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ACCEPT_ATTRIBUTE, MAX_FILES } from "@/lib/uploads";
import { createProjectUploadSlots, finishProjectUpload } from "@/app/dashboard/documents/actions";

export function ProjectUpload({ projects }: { projects: { id: string; label: string }[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const submissionId = String(formData.get("submission_id") ?? "");
    const files = input.current?.files ? Array.from(input.current.files) : [];
    if (!files.length) return setMessage("Choose at least one file.");
    setBusy(true); setMessage(null);
    try {
      const slots = await createProjectUploadSlots(submissionId, files.map((file) => ({ name: file.name, type: file.type, size: file.size })));
      if (!slots.ok) return setMessage(slots.error);
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const uploaded: { path: string; fileName: string }[] = [];
      for (const [index, slot] of slots.slots.entries()) {
        const result = await supabase.storage.from("submission-documents").uploadToSignedUrl(slot.path, slot.token, files[index], { contentType: files[index].type || undefined });
        if (result.error) throw new Error(`Could not upload ${files[index].name}.`);
        uploaded.push({ path: slot.path, fileName: slot.fileName });
      }
      const confirmed = await finishProjectUpload(submissionId, uploaded);
      if (!confirmed.ok) return setMessage(confirmed.rejected.map((item) => `${item.fileName}: ${item.reason}`).join(" ") || "The upload could not be saved.");
      setMessage(`${confirmed.accepted} ${confirmed.accepted === 1 ? "file" : "files"} added. The project review is being refreshed.`);
      if (input.current) input.current.value = "";
    } catch (error) { setMessage(error instanceof Error ? error.message : "The upload did not finish. Try again."); }
    finally { setBusy(false); }
  }

  return <form action={submit} className="grid gap-4">
    <label className="grid gap-1 text-sm font-medium text-millscale">Approval project<select name="submission_id" required className="border border-zinc-dust bg-white px-3 py-2.5">{projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
    <label className="grid gap-1 text-sm font-medium text-millscale">Documents or photos<input ref={input} type="file" multiple required accept={ACCEPT_ATTRIBUTE} className="border border-dashed border-zinc-dust bg-white p-4 text-sm" /></label>
    <p className="text-xs text-slate-wash">PDF, Word, JPG or PNG. Up to {MAX_FILES} files. A file with the same name becomes a new version; identical content is not stored twice.</p>
    <button disabled={busy} className="btn-primary justify-self-start disabled:opacity-60">{busy ? "Uploading…" : "Upload evidence"}</button>
    {message ? <p role="status" className="text-sm text-millscale">{message}</p> : null}
  </form>;
}
