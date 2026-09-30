import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { esAdmin } from "./admin-emails.ts";

const ID = "5f0c6b1e-0000-4000-8000-000000000001";
const admin = { id: ID, email: "admin@ejemplo.uy", email_confirmed_at: "2026-01-01T00:00:00Z" };

afterEach(() => {
  delete process.env.ADMIN_USER_IDS;
  delete process.env.ADMIN_EMAILS;
});

describe("allowlist del backoffice", () => {
  it("con ids, entra solo el id, sin mirar el email", () => {
    process.env.ADMIN_USER_IDS = ` ${ID.toUpperCase()} , otro`;
    process.env.ADMIN_EMAILS = "admin@ejemplo.uy";
    assert.equal(esAdmin(admin), true);
    assert.equal(esAdmin({ ...admin, email_confirmed_at: null }), true);
    assert.equal(esAdmin({ ...admin, id: "5f0c6b1e-0000-4000-8000-000000000002" }), false);
    assert.equal(esAdmin({ email: "admin@ejemplo.uy", email_confirmed_at: "2026-01-01T00:00:00Z" }), false);
    assert.equal(esAdmin(null), false);
  });

  it("sin ids, sigue la allowlist por email confirmado", () => {
    process.env.ADMIN_EMAILS = "Admin@Ejemplo.uy";
    assert.equal(esAdmin(admin), true);
    assert.equal(esAdmin({ ...admin, email_confirmed_at: null }), false);
    assert.equal(esAdmin({ ...admin, email: "otro@ejemplo.uy" }), false);
  });

  it("sin configuración no entra nadie", () => {
    assert.equal(esAdmin(admin), false);
  });
});
