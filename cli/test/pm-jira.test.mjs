import { test } from "node:test";
import assert from "node:assert/strict";
import { jiraIssueUrl, jiraCommentUrl, jiraAuthHeaders, jiraIssueToText, jiraAdapter, adfToMarkdown, markdownToAdf } from "../lib/pm-jira.mjs";
import { parseUS } from "../lib/us.mjs";
import { acHash } from "../lib/ac-hash.mjs";
import { withMockFetch, mockResponse } from "./helpers.mjs";

const ENV = { DAI_JIRA_BASE_URL: "https://j.acme.com", DAI_JIRA_EMAIL: "a@b.com", DAI_JIRA_TOKEN: "tok" };

// ADF real de Jira Cloud (estructura tomada de una respuesta v3 real).
const ADF = {
  type: "doc", version: 1, content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Description:" }] },
    { type: "paragraph", content: [{ type: "text", text: "Como comprador quiero finalizar la compra." }] },
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Criterios de aceptación" }] },
    { type: "bulletList", content: [
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Dado un carrito con productos, cuando finalizo, entonces se crea la orden" }] }] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Dado un carrito vacío, cuando finalizo, entonces se rechaza" }] }] },
    ] },
  ],
};

test("adfToMarkdown convierte headings y bullets a markdown", () => {
  const md = adfToMarkdown(ADF);
  assert.match(md, /## Criterios de aceptación/);
  assert.match(md, /- Dado un carrito con productos/);
  assert.match(md, /- Dado un carrito vacío/);
});

test("[Jira Cloud] la US con descripción ADF produce un ac_hash válido", () => {
  const json = { key: "PR2-493", fields: { summary: "Finalizar la compra del carrito", description: ADF } };
  const us = parseUS(jiraIssueToText(json));
  assert.equal(us.title, "Finalizar la compra del carrito");   // del campo summary, no del ADF
  assert.match(us.ac_hash, /^[0-9a-f]{8}$/);                    // encontró los criterios en el ADF
});

test("[red] jira fetchUS pega a la URL v3, con auth, y mapea la US ADF", async () => {
  await withMockFetch(
    () => mockResponse(200, { key: "PR2-493", fields: { summary: "Finalizar la compra", description: ADF } }),
    async (calls) => {
      const us = await jiraAdapter(ENV).fetchUS("PR2-493");
      assert.match(calls[0].url, /\/rest\/api\/3\/issue\/PR2-493/);
      assert.match(calls[0].opts.headers.Authorization, /^Basic /);
      assert.equal(us.title, "Finalizar la compra");
      assert.match(us.ac_hash, /^[0-9a-f]{8}$/);
    }
  );
});

test("[red] jira fetchUS 404 → null", async () => {
  await withMockFetch(() => mockResponse(404, ""), async () => {
    assert.equal(await jiraAdapter(ENV).fetchUS("NOPE-1"), null);
  });
});

test("[red] jira fetchUS error != 404 → throw", async () => {
  await withMockFetch(() => mockResponse(500, "boom"), async () => {
    await assert.rejects(jiraAdapter(ENV).fetchUS("ABC-1"), /jira 500/);
  });
});

test("[red] jira stamp postea el comentario como ADF con la cobertura", async () => {
  await withMockFetch(() => mockResponse(201, {}), async (calls) => {
    const url = await jiraAdapter(ENV).stamp("ABC-482",
      { repo: "frontend", change: "c", version: "v1", ac_hash: "x", status: "al-dia" });
    assert.equal(calls[0].opts.method, "POST");
    assert.match(calls[0].url, /\/rest\/api\/3\/issue\/ABC-482\/comment/);
    const body = JSON.parse(calls[0].opts.body).body;
    assert.equal(body.type, "doc");                              // es ADF, no string
    assert.match(JSON.stringify(body), /Cobertura de ABC-482/);
    assert.match(url, /\/browse\/ABC-482/);
  });
});

test("jiraIssueUrl y jiraCommentUrl (v3, trim de la base)", () => {
  assert.equal(jiraIssueUrl("https://j.acme.com/", "ABC-482"),
    "https://j.acme.com/rest/api/3/issue/ABC-482?fields=summary,description");
  assert.equal(jiraCommentUrl("https://j.acme.com", "ABC-482"),
    "https://j.acme.com/rest/api/3/issue/ABC-482/comment");
});

test("jiraAuthHeaders arma Basic email:token en base64", () => {
  const h = jiraAuthHeaders({ DAI_JIRA_EMAIL: "a@b.com", DAI_JIRA_TOKEN: "tok" });
  const expected = "Basic " + Buffer.from("a@b.com:tok").toString("base64");
  assert.equal(h.Authorization, expected);
});

test("jiraIssueToText soporta también descripción string (Server/DC)", () => {
  const json = { key: "ABC-482", fields: {
    summary: "Finalizar la compra del carrito",
    description: "## Criterios de aceptación\n- Dado un carrito vacío\n- Cuando se finaliza\n- Entonces se rechaza",
  } };
  const us = parseUS(jiraIssueToText(json));
  assert.equal(us.title, "Finalizar la compra del carrito");
  assert.match(us.ac_hash, /^[0-9a-f]{8}$/);
});

test("markdownToAdf convierte headings, párrafos y bullets a ADF válido", () => {
  const adf = markdownToAdf("# T\n\nUn párrafo.\n\n## Criterios de aceptación\n- Dado x\n- Cuando y");
  assert.equal(adf.type, "doc");
  const types = adf.content.map((n) => n.type);
  assert.ok(types.includes("heading"));
  assert.ok(types.includes("bulletList"));
  const h2 = adf.content.find((n) => n.type === "heading" && n.attrs.level === 2);
  assert.equal(h2.content[0].text, "Criterios de aceptación");
});

test("[red] jira createUS postea a /issue con project+issuetype y devuelve el key", async () => {
  await withMockFetch(() => mockResponse(201, { key: "PROJ-124" }), async (calls) => {
    const env2 = { ...ENV, DAI_JIRA_PROJECT: "PROJ", DAI_JIRA_ISSUETYPE: "Story" };
    const r = await jiraAdapter(env2).createUS({ title: "Modal de confirmación", descriptionMarkdown: "# Modal\n\n## Criterios de aceptación\n- Dado x" });
    assert.equal(calls[0].opts.method, "POST");
    assert.match(calls[0].url, /\/rest\/api\/3\/issue$/);
    const body = JSON.parse(calls[0].opts.body);
    assert.equal(body.fields.project.key, "PROJ");
    assert.equal(body.fields.summary, "Modal de confirmación");
    assert.equal(body.fields.description.type, "doc");   // ADF
    assert.equal(r.id, "PROJ-124");
    assert.match(r.url, /\/browse\/PROJ-124/);
  });
});

test("[red] jira createUS sin DAI_JIRA_PROJECT → error claro", async () => {
  await assert.rejects(jiraAdapter(ENV).createUS({ title: "X", descriptionMarkdown: "y" }), /DAI_JIRA_PROJECT/);
});
