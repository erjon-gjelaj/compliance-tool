import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PageIntro } from "@/components/page-intro";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";
import { GAP_CHECK_HREF } from "@/lib/nav";
import { MAX_FILES, MAX_TOTAL_BYTES, formatBytes } from "@/lib/uploads";

const PAGE_TITLE = "Privacy";

const PAGE_DESCRIPTION =
  "What happens to the answers and the safety documents you send us: where " +
  "they are stored, who can see them, what they are used for, and how to " +
  "have them deleted.";

export const metadata: Metadata = pageMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: "/privacy",
});

/*
 * Written to be read by the person about to upload their safety file, not by
 * a lawyer. Every statement here describes something the code actually does
 * — if a claim on this page and the behaviour in src/lib/documents.ts ever
 * disagree, the page is the thing that is wrong.
 */
export default function PrivacyPage() {
  return (
    <main className="flex-1">
      <PageIntro tag="Privacy" tickId="tick-privacy" title="What we do with what you send">
        <p>
          You are being asked to hand over your company&apos;s safety
          paperwork to a stranger on the internet. That is a reasonable thing
          to be careful about, so here is exactly what happens to it.
        </p>
      </PageIntro>

      <section aria-labelledby="privacy-body-heading">
        <h2 id="privacy-body-heading" className="sr-only">
          Privacy detail
        </h2>

        <div className="mx-auto max-w-3xl px-6 py-14 md:py-16">
          <div className="grid gap-10">
            <section aria-labelledby="privacy-what">
              <h3 id="privacy-what" className="type-h3">
                What we collect
              </h3>
              <p className="type-body mt-4">
                Whatever you type into the gap-check form: your trade, who
                asked you to register, which platform and by when, your name
                and email address, and — if you fill in the optional steps —
                your crew size, the states you work in, your EMR and TRIR, and
                which documents you say you already have.
              </p>
              <p className="type-body mt-4">
                And any files you choose to attach on the last step. That step
                is optional, and skipping it does not stop you getting a
                reply.
              </p>
            </section>

            <section aria-labelledby="privacy-documents">
              <h3 id="privacy-documents" className="type-h3">
                Where your documents go
              </h3>
              <p className="type-body mt-4">
                They are uploaded straight from your browser into private
                storage. Private means there is no public link to them — not
                an obscure one, not a hard-to-guess one, none. The only way to
                open a file is a temporary link we generate to read it, which
                expires within minutes.
              </p>
              <p className="type-body mt-4">
                We accept up to {MAX_FILES} files,{" "}
                {formatBytes(MAX_TOTAL_BYTES)} altogether, and only documents
                and photos — PDFs, Word files, and images. Anything else is
                refused and deleted rather than kept.
              </p>
            </section>

            <section aria-labelledby="privacy-use">
              <h3 id="privacy-use" className="type-h3">
                What they are used for
              </h3>
              <p className="type-body mt-4">
                Preparing your review, and nothing else. We read what you sent
                to work out what your prequalification file still looks short
                on.
              </p>
              <p className="type-body mt-4">
                We do not sell your details or your documents. We do not pass
                them to a hiring client, to ISNetworld, to Avetta, or to any
                other prequalification platform. We do not put you on a
                mailing list.
              </p>
            </section>

            <section aria-labelledby="privacy-keep">
              <h3 id="privacy-keep" className="type-h3">
                How long we keep them
              </h3>
              <p className="type-body mt-4">
                For as long as we are working on your gap check, and after
                that only so we can answer you if you come back to us about
                it. We are early enough that we would rather tell you the
                honest version — there is no automatic deletion schedule
                running yet — than quote you a retention period we are not
                enforcing.
              </p>
              <p className="type-body mt-4">
                What we do have is a deletion that actually deletes. Email{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-verdigris underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                and ask, and your answers and your files both go — the record
                and the documents themselves, not the record with the files
                left sitting in storage.
              </p>
            </section>

            <section aria-labelledby="privacy-not">
              <h3 id="privacy-not" className="type-h3">
                What we are not
              </h3>
              <p className="type-body mt-4">
                {SITE_NAME} is independent. We are not affiliated with,
                endorsed by, or acting on behalf of ISNetworld, Avetta, or any
                hiring client. We never log in to your prequalification
                account and we never ask for those credentials — if anyone
                asks you for them, including someone claiming to be us, that
                is worth refusing.
              </p>
              <p className="type-body mt-4">
                A gap check is guidance to help you prepare your own
                submission. It is not a compliance determination and it is not
                legal advice.
              </p>
            </section>

            <section aria-labelledby="privacy-ask">
              <h3 id="privacy-ask" className="type-h3">
                Asking us something
              </h3>
              <p className="type-body mt-4">
                If you want to know what we hold on you, have it corrected, or
                have it deleted, email{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-verdigris underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>
                . A person reads it and you get a straight answer.
              </p>
              <p className="type-body mt-4">
                Not sent us anything yet and still deciding?{" "}
                <Link
                  href={GAP_CHECK_HREF}
                  className="text-verdigris underline underline-offset-4"
                >
                  The gap check
                </Link>{" "}
                works perfectly well without attaching a single file.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
