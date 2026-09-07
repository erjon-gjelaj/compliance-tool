import { strict as assert } from "node:assert";
import { test } from "node:test";

import { REQUIREMENTS, requirementsFor, anyVerified } from "./index.ts";
import { TRADES, PLATFORMS } from "../intake.ts";

/**
 * The reference data, and the filter that decides who is told what.
 *
 * Until 2026-09-07 every entry was `trades: "all"`, so `requirementsFor` had
 * nothing to do and a scaffolder and a welder received an identical list.
 * These tests exist because the failures here are all silent: a requirement
 * that reaches nobody, or one that reaches somebody it does not apply to,
 * both look exactly like a working system from the outside.
 */

const ids = (list: readonly { id: string }[]) => list.map((r) => r.id);

/* ------------------------------------------------------------------ *
 * The silent failures
 * ------------------------------------------------------------------ */

test("every trade named in the data is a real trade from the intake", () => {
  // The worst bug this file can have. "Welding/fabrication" instead of
  // "Welding / fabrication" matches nobody, forever, with no error anywhere
  // — the requirement simply never appears for anyone and nothing complains.
  const known = new Set<string>(TRADES);

  for (const requirement of REQUIREMENTS) {
    if (requirement.trades === "all") continue;

    for (const trade of requirement.trades) {
      assert.ok(
        known.has(trade),
        `"${requirement.id}" names trade "${trade}", which is not in TRADES — ` +
          "it will never match anybody",
      );
    }
  }
});

test("every platform named in the data is a real platform from the intake", () => {
  const known = new Set<string>(PLATFORMS);

  for (const requirement of REQUIREMENTS) {
    if (requirement.platforms === "all") continue;

    for (const platform of requirement.platforms) {
      assert.ok(known.has(platform), `"${requirement.id}" names unknown platform "${platform}"`);
    }
  }
});

test("every trade in the intake gets a usable list", () => {
  // A trade that matched nothing would produce an empty review, which reads
  // as "you need nothing" rather than as a bug.
  for (const trade of TRADES) {
    const list = requirementsFor({ trade, platform: "ISNetworld" });
    assert.ok(list.length >= 10, `${trade} only matched ${list.length} requirements`);
  }
});

test("ids are unique", () => {
  const seen = ids(REQUIREMENTS);
  assert.equal(new Set(seen).size, seen.length, "a duplicate id silently shadows another entry");
});

test("nothing claims OSHA as its source without verification", () => {
  // The most damaging mistake this file can make is citing a regulation for
  // a contractual requirement. Nothing may carry source "osha" yet.
  for (const requirement of REQUIREMENTS) {
    assert.notEqual(
      requirement.source,
      "osha",
      `"${requirement.id}" claims OSHA as its source`,
    );
  }
});

test("nothing is marked verified until a person has checked it", () => {
  // Flipping this is a deliberate act by somebody who read a real ISN list or
  // a real rejection letter. When that happens this test is what they update,
  // which is the point — it forces the change to be noticed.
  assert.equal(anyVerified(), false, "an entry was marked verified — was it really checked?");
});

/* ------------------------------------------------------------------ *
 * The filter actually filters now
 * ------------------------------------------------------------------ */

test("a scaffolder is told about scaffolding and not about welding", () => {
  const list = ids(requirementsFor({ trade: "Scaffolding", platform: "ISNetworld" }));

  assert.ok(list.includes("scaffolding-safety"));
  assert.ok(list.includes("fall-protection"), "core requirements still apply");

  // Telling a scaffolding crew they are missing a hot work permit program is
  // the exact over-reach this filter exists to prevent.
  assert.ok(!list.includes("hot-work"));
  assert.ok(!list.includes("welding-cutting"));
  assert.ok(!list.includes("electrical-safety"));
  assert.ok(!list.includes("asbestos"));
});

test("an electrician is told about arc flash and not about hydroblasting", () => {
  const list = ids(requirementsFor({ trade: "Electrical", platform: "Avetta" }));

  assert.ok(list.includes("electrical-safety"));
  assert.ok(list.includes("arc-flash"));
  assert.ok(list.includes("aerial-lifts"));

  assert.ok(!list.includes("hydroblasting"));
  assert.ok(!list.includes("scaffolding-safety"));
  assert.ok(!list.includes("asbestos"));
});

test("a welder gets hot work; an insulator gets asbestos; they are not the same list", () => {
  const welder = ids(requirementsFor({ trade: "Welding / fabrication", platform: "ISNetworld" }));
  const insulator = ids(requirementsFor({ trade: "Insulation", platform: "ISNetworld" }));

  assert.ok(welder.includes("hot-work"));
  assert.ok(insulator.includes("asbestos"));

  assert.ok(!welder.includes("asbestos"));
  assert.ok(!insulator.includes("hot-work"));

  // The whole point of the change. If these ever match again, the trade axis
  // has quietly stopped working.
  assert.notDeepEqual(welder, insulator, "two different trades got an identical list");
});

test("industrial cleaning gets the water blasting entry nobody else does", () => {
  const cleaning = ids(requirementsFor({ trade: "Industrial cleaning", platform: "ISNetworld" }));
  assert.ok(cleaning.includes("hydroblasting"));

  for (const trade of TRADES.filter((t) => t !== "Industrial cleaning")) {
    const other = ids(requirementsFor({ trade, platform: "ISNetworld" }));
    assert.ok(!other.includes("hydroblasting"), `${trade} was offered hydroblasting`);
  }
});

test('"Other" gets the core list and no trade-specific guesses', () => {
  // Somebody typed their own trade. Matching a scaffolding requirement
  // because their free text contained a word we liked is exactly the
  // over-matching this file exists to prevent.
  const other = ids(requirementsFor({ trade: "Other — pipefitting", platform: "ISNetworld" }));

  assert.ok(other.includes("hazard-communication"), "core still applies to everyone");
  assert.ok(other.includes("ppe"));

  const tradeSpecific = REQUIREMENTS.filter((r) => r.trades !== "all").map((r) => r.id);
  for (const id of tradeSpecific) {
    assert.ok(!other.includes(id), `"Other" was given the trade-specific "${id}"`);
  }
});

/* ------------------------------------------------------------------ *
 * The platform axis
 * ------------------------------------------------------------------ */

test('"Both" and "Not sure" never narrow the list', () => {
  // Neither is a platform name. Filtering on them would drop requirements on
  // a guess about which platform somebody meant.
  for (const trade of TRADES) {
    const isn = requirementsFor({ trade, platform: "ISNetworld" }).length;
    const both = requirementsFor({ trade, platform: "Both" }).length;
    const unsure = requirementsFor({ trade, platform: "Not sure" }).length;

    assert.ok(both >= isn, `${trade}: "Both" returned fewer than ISNetworld`);
    assert.ok(unsure >= isn, `${trade}: "Not sure" returned fewer than ISNetworld`);
  }
});

test("trade matching ignores case but not identity", () => {
  const exact = ids(requirementsFor({ trade: "Scaffolding", platform: "ISNetworld" }));
  const shouted = ids(requirementsFor({ trade: "SCAFFOLDING", platform: "ISNetworld" }));

  assert.deepEqual(shouted, exact, "case should not change the answer");

  // But a different trade that merely contains the word must not match.
  const near = ids(requirementsFor({ trade: "Scaffolding inspection consultancy", platform: "ISNetworld" }));
  assert.ok(
    !near.includes("scaffolding-safety"),
    "a substring match would hand requirements to trades we never assessed",
  );
});

/* ------------------------------------------------------------------ *
 * Shape
 * ------------------------------------------------------------------ */

test("every entry can actually be found in a document", () => {
  for (const requirement of REQUIREMENTS) {
    assert.ok(requirement.phrases.length > 0, `"${requirement.id}" has no search phrases`);

    for (const phrase of requirement.phrases) {
      assert.equal(
        phrase,
        phrase.toLowerCase(),
        `"${requirement.id}" has a phrase with capitals: matching is done in lower case`,
      );
      assert.ok(phrase.trim().length > 2, `"${requirement.id}" has a phrase too short to be meaningful`);
    }
  }
});

test("every entry tells the contractor what to do about it", () => {
  for (const requirement of REQUIREMENTS) {
    assert.ok(requirement.action.trim().length > 10, `"${requirement.id}" has no useful action`);
    assert.ok(requirement.label.trim().length > 0);
  }
});

test("every trade-specific entry records where it came from", () => {
  // The core twelve predate the sources field and are grandfathered. Anything
  // narrowed to a trade is a newer claim and has to be traceable, or the
  // person verifying it has to start the research from nothing.
  for (const requirement of REQUIREMENTS) {
    if (requirement.trades === "all") continue;

    assert.ok(
      requirement.sources && requirement.sources.length > 0,
      `"${requirement.id}" is trade-specific but records no source`,
    );
  }
});
