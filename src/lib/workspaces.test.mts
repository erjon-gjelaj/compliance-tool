import { strict as assert } from "node:assert";
import { test } from "node:test";

import { resolveWorkspaceCompany } from "./workspaces.ts";
import type { CompanyRow } from "./companies.ts";

function company(id: string, email: string): CompanyRow {
  return {
    id,
    email,
    name: id,
    created_at: "",
    updated_at: "",
    website: null,
    home_state: null,
    operating_states: null,
    trade: null,
    headcount_band: null,
    platforms: null,
    hiring_clients: null,
    operations: null,
    field_sources: {},
    plan: "free",
    managed_by_email: null,
    consultant_brand_name: null,
    invited_at: null,
    accepted_at: null,
  };
}

const own = company("consultant", "consultant@example.com");
const client = company("client", "client@example.com");

test("a contractor cannot switch even with a forged cookie value", () => {
  assert.equal(
    resolveWorkspaceCompany({
      ownCompany: own,
      managedCompanies: [client],
      permitted: false,
      selectedId: client.id,
    }),
    own,
  );
});

test("a consultant can select a company in the managed set", () => {
  assert.equal(
    resolveWorkspaceCompany({
      ownCompany: own,
      managedCompanies: [client],
      permitted: true,
      selectedId: client.id,
    }),
    client,
  );
});

test("an inaccessible company id falls back to the consultant workspace", () => {
  assert.equal(
    resolveWorkspaceCompany({
      ownCompany: own,
      managedCompanies: [client],
      permitted: true,
      selectedId: "somebody-elses-company",
    }),
    own,
  );
});
