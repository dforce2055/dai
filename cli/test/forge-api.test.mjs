import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrRef, prApiUrl, commentApiUrl, authHeaders, renderReviewComment, getPR, postComment } from "../lib/forge-api.mjs";
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
      assert.deepEqual(pr, { title: "T", state: "open", body: "B", branch: "feature/x", url: "https://gh/pr/5" });
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
