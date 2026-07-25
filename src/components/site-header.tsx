import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-dust">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark />
        <a
          href="#gap-check"
          className="font-mono text-xs uppercase tracking-[0.12em] text-slate-wash underline decoration-zinc-dust underline-offset-[6px] transition-colors hover:text-verdigris hover:decoration-verdigris"
        >
          Free gap check
        </a>
      </div>
    </header>
  );
}
