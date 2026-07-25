import { Wordmark } from "@/components/wordmark";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <Wordmark />
        <div className="max-w-md space-y-3 text-sm leading-relaxed text-slate-wash">
          <p>
            {SITE_NAME} is an independent service and is not affiliated with,
            endorsed by, or acting on behalf of ISNetworld, Avetta, or any
            hiring client. A gap check is guidance to help you prepare your own
            submission, not a compliance determination.
          </p>
          <p>
            Questions:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-verdigris underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
