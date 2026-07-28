import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The server/client boundary rules, checked statically.
 *
 * These exist because two production 500s in a row came from breaking them,
 * and neither was caught by the build, the linter, or a hundred-odd tests. Both
 * are runtime faults that only appear when a module is first evaluated on a
 * real signed-in request — which never happens locally, because the dashboard
 * needs credentials this environment does not have.
 *
 * A static check over the source is not a substitute for running the app. It
 * is, however, the cheapest thing that would have caught both, and it runs
 * everywhere.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) && !/\.test\.mts$/.test(path) ? [path] : [];
  });
}

const FILES = walk(SRC).map((path) => ({
  path: path.slice(SRC.length + 1).replace(/\\/g, "/"),
  source: readFileSync(path, "utf8"),
}));

/** A directive on the first line of the file, not one inside a function. */
function hasFileDirective(source: string, directive: string): boolean {
  const firstLine = source.trimStart().split("\n")[0]?.trim() ?? "";
  return firstLine === `"${directive}";` || firstLine === `'${directive}';`;
}

test('a "use server" file exports only async functions', () => {
  // "A 'use server' file can only export async functions, found object."
  // Exporting a state object beside its action throws that on first
  // evaluation, and the page 500s. Types are erased and are fine.
  const offenders: string[] = [];

  for (const { path, source } of FILES) {
    if (!hasFileDirective(source, "use server")) continue;

    for (const line of source.split("\n")) {
      const match = /^export\s+(const|let|var|class|function)\s+(\w+)/.exec(
        line.trim(),
      );

      if (!match) continue;

      // A plain `export function` is not async either, and is equally invalid.
      offenders.push(`${path}: export ${match[1]} ${match[2]}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `"use server" modules may only export async functions:\n${offenders.join("\n")}`,
  );
});

test('a "use client" file does not import a "server-only" module', () => {
  // Pulls the service-role client into the browser bundle and fails the build,
  // which is the good case — but the failure names the transitive import
  // rather than the boundary, and is slow to read.
  const serverOnly = new Set(
    FILES.filter(({ source }) => /^import "server-only";/m.test(source)).map(
      ({ path }) => path.replace(/\.tsx?$/, ""),
    ),
  );

  const offenders: string[] = [];

  for (const { path, source } of FILES) {
    if (!hasFileDirective(source, "use client")) continue;

    /*
     * Value imports only. `import type { CompanyRow } from "@/lib/companies"`
     * is erased by the compiler, so it never reaches the bundle and is a
     * legitimate way for a client component to share a row's shape — flagging
     * it would make this guard cry wolf, and a guard that cries wolf gets
     * deleted rather than fixed.
     */
    const statements = source.matchAll(
      /^import\s+(type\s+)?([^;]*?)from "@\/([^"]+)";/gm,
    );

    for (const [, typeOnly, clause, module] of statements) {
      if (typeOnly) continue;
      if (!serverOnly.has(module)) continue;

      // An inline `import { type A, type B }` is erased too. Only a clause
      // with at least one non-type binding actually imports anything.
      const bindings = clause
        .replace(/[{}]/g, "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (bindings.every((entry) => entry.startsWith("type "))) continue;

      offenders.push(`${path} imports ${module}`);
    }
  }

  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("no client component is handed a program template", () => {
  // The other production fault. A ProgramTemplate carries functions, and
  // functions cannot cross the boundary — the page must pass an id and let the
  // client look it up. Narrow on purpose: a general "is this prop
  // serialisable" check is not something grep can answer, and a wrong one
  // would be worse than none.
  const offenders = FILES.filter(({ source }) =>
    /<\w+[^>]*\stemplate=\{/.test(source),
  ).map(({ path }) => path);

  assert.deepEqual(
    offenders,
    [],
    `pass a program id, not the template:\n${offenders.join("\n")}`,
  );
});
