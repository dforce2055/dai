import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrRef, prApiUrl, commentApiUrl, authHeaders, renderReviewComment, getPR, postComment, reviewApiUrl, inlinePosition, postReview } from "../lib/forge-api.mjs";
import { withMockFetch, mockResponse } from "./helpers.mjs";

test("parsePrRef desde URL de GitHub", () => {
  const r = parsePrRef("https://github.com/org/frontend/pull/482");
  assert.equal(r.forge, "github");
  assert.equal(r.owner, "org");
  assert.equal(r.repo, "frontend");
  assert.equal(r.number, 482);
});

test("parsePrRef desde URL de GitLab (grupo anidado)", () => {
  const r = parsePrRef("https://gitlab.acme.com/grupo/sub/frontend/-/merge_requests/7");
  assert.equal(r.forge, "gitlab");
  assert.equal(r.projectPath, "grupo/sub/frontend");
  assert.equal(r.number, 7);
});

test("parsePrRef desde número + remoto", () => {
  const r = parsePrRef("15", "git@github.com:org/frontend.git");
  assert.equal(r.forge, "github");
  assert.equal(r.projectPath, "org/frontend");
  assert.equal(r.number, 15);
});

test("prApiUrl y commentApiUrl para GitHub", () => {
  const r = parsePrRef("https://github.com/org/frontend/pull/482");
  assert.equal(prApiUrl(r), "https://api.github.com/repos/org/frontend/pulls/482");
  assert.equal(commentApiUrl(r), "https://api.github.com/repos/org/frontend/issues/482/comments");
});

test("prApiUrl y commentApiUrl para GitLab (project path encodeado)", () => {
  const r = parsePrRef("https://gitlab.acme.com/grupo/frontend/-/merge_requests/7");
  assert.equal(prApiUrl(r), "https://gitlab.acme.com/api/v4/projects/grupo%2Ffrontend/merge_requests/7");
  assert.equal(commentApiUrl(r), "https://gitlab.acme.com/api/v4/projects/grupo%2Ffrontend/merge_requests/7/notes");
});

test("authHeaders usa el token del forge correcto", () => {
  const gh = parsePrRef("https://github.com/o/r/pull/1");
  assert.match(authHeaders(gh, { GITHUB_TOKEN: "T" }).Authorization, /Bearer T/);
  const gl = parsePrRef("https://gitlab.com/o/r/-/merge_requests/1");
  assert.equal(authHeaders(gl, { GITLAB_TOKEN: "T" })["PRIVATE-TOKEN"], "T");
});

test("renderReviewComment arma el comentario estándar", () => {
  const c = renderReviewComment({
    us: "ABC-482", version: "v1", checkStatus: "✅ al día", dod: "4/5",
    errors: ["falta validar el input"], improvements: ["extraer un helper"], good: ["buen test del guard"],
  });
  assert.match(c, /## 🤖 dai-review/);
  assert.match(c, /ABC-482/);
  assert.match(c, /falta validar el input/);
  assert.match(c, /firma un humano/);
});

test("renderReviewComment sin US lo aclara", () => {
  const c = renderReviewComment({ errors: [], improvements: [], good: [] });
  assert.match(c, /no declara implementar una US/);
  assert.match(c, /— ninguno —/);
});

test("[red] getPR github normaliza los campos", async () => {
  const ref = parsePrRef("https://github.com/org/frontend/pull/5");
  await withMockFetch(
    () => mockResponse(200, { title: "T", state: "open", body: "B", head: { ref: "feature/x" }, html_url: "https://gh/pr/5" }),
    async (calls) => {
      const pr = await getPR(ref, { GITHUB_TOKEN: "t" });
      assert.match(calls[0].url, /api\.github\.com\/repos\/org\/frontend\/pulls\/5/);
      // baseRef/headSha/diffRefs se agregaron en 0.9.0 para poder anclar el review inline.
      // Acá el mock no los trae, así que salen null: getPR no inventa lo que la API no dio.
      assert.deepEqual(pr, { title: "T", state: "open", body: "B", branch: "feature/x", url: "https://gh/pr/5",
        baseRef: null, headSha: null, diffRefs: null });
    }
  );
});

test("[red] getPR gitlab normaliza los campos", async () => {
  const ref = parsePrRef("https://gitlab.acme.com/g/r/-/merge_requests/7");
  await withMockFetch(
    () => mockResponse(200, { title: "T", state: "opened", description: "D", source_branch: "feat", web_url: "https://gl/mr/7" }),
    async () => {
      const pr = await getPR(ref, { GITLAB_TOKEN: "t" });
      assert.equal(pr.branch, "feat");
      assert.equal(pr.url, "https://gl/mr/7");
      assert.equal(pr.body, "D");
    }
  );
});

test("[red] postComment postea el body y devuelve el url", async () => {
  const ref = parsePrRef("https://github.com/o/r/pull/1");
  await withMockFetch(() => mockResponse(201, { html_url: "https://gh/comment/1" }), async (calls) => {
    const r = await postComment(ref, "hola", { GITHUB_TOKEN: "t" });
    assert.equal(calls[0].opts.method, "POST");
    assert.equal(JSON.parse(calls[0].opts.body).body, "hola");
    assert.equal(r.url, "https://gh/comment/1");
  });
});

test("[red] postComment error → throw", async () => {
  const ref = parsePrRef("https://github.com/o/r/pull/1");
  await withMockFetch(() => mockResponse(403, "forbidden"), async () => {
    await assert.rejects(postComment(ref, "x", { GITHUB_TOKEN: "t" }), /forge 403/);
  });
});

// ── Review inline (0.9.0) ────────────────────────────────────────────────────

const GH = parsePrRef("https://github.com/acme/app/pull/22");
const GL = parsePrRef("https://gitlab.acme.com/grupo/app/-/merge_requests/7");
const DIFF_REFS = { base_sha: "base1", start_sha: "start1", head_sha: "head1" };
const C = (path, line, side = "RIGHT") => ({ path, line, side, body: `hallazgo en ${path}:${line}` });

test("reviewApiUrl apunta al endpoint de review, NO al del hilo de la PR", () => {
  assert.equal(reviewApiUrl(GH), "https://api.github.com/repos/acme/app/pulls/22/reviews");
  assert.equal(reviewApiUrl(GL), "https://gitlab.acme.com/api/v4/projects/grupo%2Fapp/merge_requests/7/discussions");
  // el del hilo sigue existiendo y es otro: es el fallback simple
  assert.match(commentApiUrl(GH), /\/issues\/22\/comments$/);
});

test("inlinePosition github: path + line + side", () => {
  assert.deepEqual(inlinePosition(GH, C("src/x.ts", 42)), { path: "src/x.ts", line: 42, side: "RIGHT", body: "hallazgo en src/x.ts:42" });
});

test("inlinePosition gitlab: los tres shas + new_line en RIGHT", () => {
  const p = inlinePosition(GL, C("src/x.ts", 42), { diffRefs: DIFF_REFS }).position;
  assert.equal(p.base_sha, "base1");
  assert.equal(p.start_sha, "start1");
  assert.equal(p.head_sha, "head1");
  assert.equal(p.position_type, "text");
  assert.equal(p.new_line, 42);
  assert.equal(p.old_line, undefined);
});

test("inlinePosition gitlab: old_line cuando el lado es LEFT", () => {
  const p = inlinePosition(GL, C("src/x.ts", 9, "LEFT"), { diffRefs: DIFF_REFS }).position;
  assert.equal(p.old_line, 9);
  assert.equal(p.new_line, undefined);
});

test("inlinePosition gitlab sin diff_refs falla con un mensaje que se entiende", () => {
  assert.throws(() => inlinePosition(GL, C("a.ts", 1), {}), /faltan los diff_refs/);
});

test("inlinePosition gitlab: start_sha cae a base_sha si no viene", () => {
  const p = inlinePosition(GL, C("a.ts", 1), { diffRefs: { base_sha: "b", head_sha: "h" } }).position;
  assert.equal(p.start_sha, "b");
});

test("[red] getPR github ahora expone headSha y baseRef (para anclar el inline)", async () => {
  await withMockFetch(() => mockResponse(200, { title: "T", state: "open", head: { ref: "feature/x", sha: "abc123" }, base: { ref: "develop" } }), async () => {
    const pr = await getPR(GH, { GITHUB_TOKEN: "t" });
    assert.equal(pr.headSha, "abc123");
    assert.equal(pr.baseRef, "develop");
  });
});

test("[red] getPR gitlab expone diffRefs y headSha", async () => {
  await withMockFetch(() => mockResponse(200, { title: "T", state: "opened", source_branch: "f/x", target_branch: "main", diff_refs: DIFF_REFS }), async () => {
    const pr = await getPR(GL, { GITLAB_TOKEN: "t" });
    assert.deepEqual(pr.diffRefs, DIFF_REFS);
    assert.equal(pr.headSha, "head1");
    assert.equal(pr.baseRef, "main");
  });
});

// El corte duro del Art. 5, en el payload.
test("[red] postReview github manda event COMMENT — nunca APPROVE", async () => {
  await withMockFetch(() => mockResponse(200, { html_url: "https://github.com/acme/app/pull/22#r1" }), async (calls) => {
    await postReview(GH, { body: "resumen", comments: [C("a.ts", 5)], headSha: "abc" }, { GITHUB_TOKEN: "t" });
    const sent = JSON.parse(calls[0].opts.body);
    assert.equal(sent.event, "COMMENT");
    assert.notEqual(sent.event, "APPROVE");
  });
});

test("[red] postReview github postea resumen + inline en UNA sola llamada (atómico)", async () => {
  await withMockFetch(() => mockResponse(200, { html_url: "https://gh/r1" }), async (calls) => {
    const r = await postReview(GH, { body: "resumen", comments: [C("a.ts", 5), C("b.ts", 9)], headSha: "abc" }, { GITHUB_TOKEN: "t" });
    assert.equal(calls.length, 1, "un solo POST: o entra todo o no entra nada");
    assert.match(calls[0].url, /\/pulls\/22\/reviews$/);
    const sent = JSON.parse(calls[0].opts.body);
    assert.equal(sent.body, "resumen");
    assert.equal(sent.comments.length, 2);
    assert.equal(sent.commit_id, "abc");
    assert.equal(r.posted, 2);
    assert.equal(r.atomic, true);
    assert.equal(r.url, "https://gh/r1");
  });
});

test("[red] postReview github propaga el error del forge (422 de posición inválida)", async () => {
  await withMockFetch(() => mockResponse(422, "line must be part of the diff"), async () => {
    await assert.rejects(postReview(GH, { body: "x", comments: [C("a.ts", 999)] }, { GITHUB_TOKEN: "t" }), /forge 422.*part of the diff/);
  });
});

test("[red] postReview gitlab: 1 nota de resumen + 1 discussion por comentario", async () => {
  await withMockFetch(() => mockResponse(200, { web_url: "https://gl/note1" }), async (calls) => {
    const r = await postReview(GL, { body: "resumen", comments: [C("a.ts", 5), C("b.ts", 9)], diffRefs: DIFF_REFS }, { GITLAB_TOKEN: "t" });
    assert.equal(calls.length, 3, "1 nota + 2 discussions");
    assert.match(calls[0].url, /\/notes$/);
    assert.match(calls[1].url, /\/discussions$/);
    assert.equal(JSON.parse(calls[1].opts.body).position.new_line, 5);
    assert.equal(r.posted, 2);
    assert.equal(r.atomic, false, "gitlab no es atómico y no lo finge");
  });
});

// GitLab no es atómico: si la 2da discussion falla, la 1ra YA está publicada. Se reporta
// qué entró y qué no, en vez de tirar y dejar al humano sin saber en qué estado quedó.
test("[red] postReview gitlab reporta los parciales en vez de fingir atomicidad", async () => {
  await withMockFetch((url) => (String(url).endsWith("/discussions") ? mockResponse(400, "bad position") : mockResponse(200, { web_url: "https://gl/n" })),
    async () => {
      const r = await postReview(GL, { body: "resumen", comments: [C("a.ts", 5), C("b.ts", 9)], diffRefs: DIFF_REFS }, { GITLAB_TOKEN: "t" });
      assert.equal(r.posted, 0);
      assert.equal(r.failed.length, 2);
      assert.match(r.failed[0].error, /forge 400/);
      assert.equal(r.failed[0].path, "a.ts");
      assert.equal(r.url, "https://gl/n", "el resumen SÍ entró: hay que decirlo");
    });
});

test("[red] postReview en un forge no soportado falla claro", async () => {
  await assert.rejects(postReview({ forge: "bitbucket", number: 1 }, { body: "x" }, {}), /no soportado para review/);
});

// ── describeForgeError (issue #24) ───────────────────────────────────────────
// El mensaje viejo era "¿token? ¿ref correcta?" para TODO: sin token, token vencido,
// sin scope y PR inexistente caían en la misma frase, y costaba una sesión de
// diagnóstico equivocado. Cada causa tiene una acción distinta y se nombra aparte.

test("describeForgeError: SIN token lo dice explícitamente, no habla de validez", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GH, { status: 401, env: {} });
  assert.match(m, /no hay GITHUB_TOKEN configurado/);
  assert.match(m, /\.env\.dai/, "dice dónde ponerlo");
  assert.doesNotMatch(m, /vencido|revocado/, "sin token no se puede afirmar que esté vencido");
});

test("describeForgeError: 401 CON token dice que el token no sirve, y cómo probarlo", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GH, { status: 401, env: { GITHUB_TOKEN: "ghp_x" } });
  assert.match(m, /NO es válido/);
  assert.match(m, /vencido, revocado, o mal copiado/);
  assert.match(m, /curl/, "da el comando para verificarlo sin adivinar");
});

test("describeForgeError: 403 es permiso/scope, no credencial inválida", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GH, { status: 403, env: { GITHUB_TOKEN: "t" } });
  assert.match(m, /válido pero NO tiene permiso/);
  assert.doesNotMatch(m, /vencido/);
});

test("describeForgeError: 403 por rate limit no manda a revisar scopes", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GH, { status: 403, body: "API rate limit exceeded", env: { GITHUB_TOKEN: "t" } });
  assert.match(m, /rate limit/);
  assert.doesNotMatch(m, /scope/);
});

// El 404 de GitHub sobre un repo privado es ambiguo POR DISEÑO (no filtra existencia).
// Fingir que solo puede ser "la ref está mal" es lo que mandó el diagnóstico para el lado
// equivocado la primera vez.
test("describeForgeError: 404 nombra las DOS causas y no elige una", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GH, { status: 404, env: { GITHUB_TOKEN: "t" } });
  assert.match(m, /no existe con ese número/i);
  assert.match(m, /privado/);
});

test("describeForgeError: gitlab habla de GITLAB_TOKEN, no de GITHUB_TOKEN", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GL, { status: 401, env: {} });
  assert.match(m, /GITLAB_TOKEN/);
  assert.doesNotMatch(m, /GITHUB_TOKEN/);
});

test("describeForgeError: sin status es un problema de red, no de credencial", async () => {
  const { describeForgeError } = await import("../lib/forge-api.mjs");
  const m = describeForgeError(GH, { env: { GITHUB_TOKEN: "t" }, cause: "getaddrinfo ENOTFOUND" });
  assert.match(m, /red \/ proxy \/ VPN/);
});

test("parseForgeError: separa el status del cuerpo que pegó getPR", async () => {
  const { parseForgeError } = await import("../lib/forge-api.mjs");
  assert.deepEqual(parseForgeError(new Error('forge 401: {"message":"Bad credentials"}')),
    { status: 401, body: '{"message":"Bad credentials"}' });
  const other = parseForgeError(new Error("fetch failed"));
  assert.equal(other.status, null);
  assert.equal(other.cause, "fetch failed");
});

test("tokenFor: un token con espacios de más cuenta como ausente", async () => {
  const { tokenFor, describeForgeError } = await import("../lib/forge-api.mjs");
  assert.equal(tokenFor(GH, { GITHUB_TOKEN: "  " }), "");
  assert.match(describeForgeError(GH, { status: 401, env: { GITHUB_TOKEN: "  " } }), /no hay GITHUB_TOKEN/);
});
