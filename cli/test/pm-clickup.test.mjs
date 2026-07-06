import { test } from "node:test";
import assert from "node:assert/strict";
import { clickupTaskUrl, clickupCommentUrl, clickupAuthHeaders, clickupTaskToText, clickupAdapter } from "../lib/pm-clickup.mjs";
import { parseUS } from "../lib/us.mjs";
import { withMockFetch, mockResponse } from "./helpers.mjs";

const ENV = { DAI_CLICKUP_TOKEN: "pk_1" };

test("[red] clickup fetchUS pega a la URL, con auth, y mapea la US", async () => {
  await withMockFetch(
    () => mockResponse(200, { id: "abc", name: "Finalizar la compra",
      markdown_description: "spec_version v3\n\n## Criterios de aceptación\n- Dado x\n- Cuando y\n- Entonces z" }),
    async (calls) => {
      const us = await clickupAdapter(ENV).fetchUS("abc");
      assert.match(calls[0].url, /\/task\/abc\?include_markdown_description=true$/);
      assert.equal(calls[0].opts.headers.Authorization, "pk_1");
      assert.equal(us.spec_version, "v3");
      assert.equal(us.title, "Finalizar la compra");
    }
  );
});

test("[red] clickup stamp postea comment_text con la cobertura", async () => {
  await withMockFetch(() => mockResponse(200, {}), async (calls) => {
    await clickupAdapter(ENV).stamp("abc",
      { repo: "frontend", change: "c", version: "v1", ac_hash: "x", status: "atrasado" });
    assert.equal(calls[0].opts.method, "POST");
    assert.match(calls[0].url, /\/task\/abc\/comment/);
    assert.match(JSON.parse(calls[0].opts.body).comment_text, /Cobertura de abc/);
  });
});

test("[red] clickup error → throw", async () => {
  await withMockFetch(() => mockResponse(401, "nope"), async () => {
    await assert.rejects(clickupAdapter(ENV).fetchUS("abc"), /clickup 401/);
  });
});

test("clickupTaskUrl y clickupCommentUrl", () => {
  assert.equal(clickupTaskUrl("abc123"), "https://api.clickup.com/api/v2/task/abc123?include_markdown_description=true");
  assert.equal(clickupCommentUrl("abc123"), "https://api.clickup.com/api/v2/task/abc123/comment");
});

test("clickupAuthHeaders pone el token en Authorization", () => {
  assert.equal(clickupAuthHeaders({ DAI_CLICKUP_TOKEN: "pk_1" }).Authorization, "pk_1");
});

test("clickupTaskToText + parseUS extraen la US", () => {
  const json = {
    id: "abc123",
    name: "Finalizar la compra del carrito",
    markdown_description: "spec_version v2\n\n## Criterios de aceptación\n- Dado un carrito vacío\n- Cuando se finaliza\n- Entonces se rechaza",
  };
  const us = parseUS(clickupTaskToText(json));
  assert.equal(us.title, "Finalizar la compra del carrito");
  assert.equal(us.spec_version, "v2");
  assert.match(us.ac_hash, /^[0-9a-f]{8}$/);
});
