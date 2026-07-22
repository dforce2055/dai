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

// La URL canónica trae el team_id (/t/<team>/<id>), que no se puede derivar del id.
// Antes fetchUS la descartaba y dai armaba el link con un template configurado a mano.
test("[red] clickup fetchUS devuelve la URL canónica de la tarea", async () => {
  await withMockFetch(
    () => mockResponse(200, { id: "abc", name: "Finalizar la compra",
      url: "https://app.clickup.com/t/90130000000/abc" }),
    async () => {
      const us = await clickupAdapter(ENV).fetchUS("abc");
      assert.equal(us.url, "https://app.clickup.com/t/90130000000/abc");
    }
  );
});

test("[red] clickup fetchUS sin url en la respuesta → url null (no rompe)", async () => {
  await withMockFetch(() => mockResponse(200, { id: "abc", name: "X" }), async () => {
    assert.equal((await clickupAdapter(ENV).fetchUS("abc")).url, null);
  });
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

test("[red] clickup createUS postea a /list/{id}/task y devuelve el id", async () => {
  await withMockFetch(() => mockResponse(200, { id: "86new", url: "https://ck/t/86new" }), async (calls) => {
    const r = await clickupAdapter({ DAI_CLICKUP_TOKEN: "pk", DAI_CLICKUP_LIST_ID: "L1" })
      .createUS({ title: "Modal", descriptionMarkdown: "## Criterios de aceptación\n- Dado x" });
    assert.equal(calls[0].opts.method, "POST");
    assert.match(calls[0].url, /\/list\/L1\/task$/);
    assert.equal(JSON.parse(calls[0].opts.body).name, "Modal");
    assert.equal(r.id, "86new");
  });
});

test("[red] clickup createUS sin DAI_CLICKUP_LIST_ID → error", async () => {
  await assert.rejects(clickupAdapter({ DAI_CLICKUP_TOKEN: "pk" }).createUS({ title: "X", descriptionMarkdown: "y" }), /DAI_CLICKUP_LIST_ID/);
});

// ── updateUS (dai update-us, issue #23) ──────────────────────────────────────

test("[red] clickup updateUS: PUT a la tarea con name + markdown_content", async () => {
  await withMockFetch(() => mockResponse(200, { id: "abc", url: "https://app.clickup.com/t/1/abc" }), async (calls) => {
    const r = await clickupAdapter(ENV).updateUS("abc", {
      title: "Finalizar la compra", descriptionMarkdown: "## Criterios de aceptación\n- Dado x\n",
    });
    assert.equal(calls[0].opts.method, "PUT");
    assert.match(calls[0].url, /\/task\/abc$/);
    assert.equal(calls[0].opts.headers.Authorization, "pk_1");
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.name, "Finalizar la compra");
    assert.match(body.markdown_content, /Criterios de aceptación/);
    assert.equal(r.url, "https://app.clickup.com/t/1/abc");
  });
});

// Un PUT con name vacío renombra la tarea a "". Solo se manda lo que cambia.
test("[red] clickup updateUS: sin título no manda name (no la renombra)", async () => {
  await withMockFetch(() => mockResponse(200, {}), async (calls) => {
    await clickupAdapter(ENV).updateUS("abc", { descriptionMarkdown: "# x\n" });
    const body = JSON.parse(calls[0].opts.body);
    assert.ok(!("name" in body));
  });
});

test("[red] clickup updateUS: 404 dice que el id no existe, no un error crudo", async () => {
  await withMockFetch(() => mockResponse(404, "not found"), async () => {
    await assert.rejects(clickupAdapter(ENV).updateUS("nope", { title: "x" }), /no existe la tarea 'nope'/);
  });
});

test("[red] clickup fetchUS devuelve el markdown crudo (lo que edit-us abre)", async () => {
  await withMockFetch(() => mockResponse(200, { id: "abc", name: "Finalizar la compra",
    markdown_description: "## Criterios de aceptación\n- Dado x\n- Cuando y\n- Entonces z" }),
    async () => {
      const us = await clickupAdapter(ENV).fetchUS("abc");
      assert.match(us.raw, /^# Finalizar la compra/);
      assert.match(us.raw, /Criterios de aceptación/);
    });
});
