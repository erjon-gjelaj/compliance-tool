"use client";

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { Check, ChevronDown } from "lucide-react";

/**
 * The one dropdown component for the site, built on Headless UI's Listbox —
 * Tailwind's own unstyled component — so the list that opens is ours to style
 * rather than the operating system's.
 *
 * A native <select> can be styled shut but not open: the list it drops is
 * drawn by the OS, arrives in the system font with the system highlight
 * colour, and ignores the page entirely. Listbox renders a real button and a
 * real list, and brings the keyboard contract with it — up/down/home/end,
 * enter and space to choose, escape to close, type-to-jump — so none of that
 * is hand-rolled here.
 *
 * `name` makes it emit a hidden input, so the server action reads the same
 * FormData key it read from the <select> and nothing behind the form changed.
 *
 * The one thing given up is the browser's "please fill this in" bubble on an
 * empty required field, which doesn't apply to a hidden input. Server-side
 * validation already covers that and renders a field error — the bubble was
 * never the guarantee.
 */
export function SelectField({
  id,
  name,
  options,
  placeholder,
  value,
  onChange,
  disabled = false,
  hasError = false,
  describedBy,
}: {
  id: string;
  name: string;
  options: readonly string[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;
  describedBy?: string;
}) {
  return (
    <Listbox name={name} value={value} onChange={onChange} disabled={disabled}>
      {/*
       * Open state comes from Listbox's own render prop rather than from a
       * group-data-[open] variant on the chevron. Both should work; the
       * variant did not apply in practice, and a plain conditional class is
       * one less thing depending on which variants Tailwind generated.
       *
       * Not anchored, so the list renders in place rather than in a portal:
       * one less thing to reason about against the sticky header, and this
       * form is never near the bottom of the viewport.
       */}
      {({ open }: { open: boolean }) => (
        <div className="relative mt-2">
          <ListboxButton
            id={id}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            className={`flex w-full items-center justify-between gap-3 border bg-paper px-3.5 py-2.5 text-left text-[0.95rem] focus:outline-none data-[disabled]:opacity-60 ${
              hasError
                ? "border-rust-flag"
                : open
                  ? "border-verdigris"
                  : "border-zinc-dust"
            }`}
          >
            <span
              className={`truncate ${value ? "text-millscale" : "text-slate-wash/70"}`}
            >
              {value || placeholder}
            </span>
            <ChevronDown
              aria-hidden="true"
              strokeWidth={1.5}
              className={`h-4 w-4 shrink-0 text-slate-wash transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </ListboxButton>

          <ListboxOptions className="absolute top-full right-0 left-0 z-20 mt-px max-h-64 overflow-auto border border-verdigris bg-paper focus:outline-none">
            {options.map((option) => (
              <ListboxOption
                key={option}
                value={option}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-[0.95rem] data-[focus]:bg-galvanise ${
                  option === value ? "text-verdigris" : "text-millscale"
                }`}
              >
                <span className="truncate">{option}</span>
                {option === value && (
                  <Check
                    aria-hidden="true"
                    strokeWidth={2}
                    className="h-4 w-4 shrink-0"
                  />
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </div>
      )}
    </Listbox>
  );
}
