import test from "node:test";
import assert from "node:assert/strict";
import { listPrCmd, parsePrList, updatePrCmd, isAlreadyExistsError, describeUpdate } from "../lib/pr-remote.mjs";

test("listPrCmd pregunta por las abiertas de ESA branch, en json", () => {
  const gh = listPrCmd("gh", "feature/ABC-1-x");
  assert.deepEqual(gh.slice(0, 6), ["pr", "list", "--head", "feature/ABC-1-x", "--state", "open"]);
  assert.ok(gh.includes("--json"));
  const glab = listPrCmd("glab", "feature/ABC-1-x");
  assert.deepEqual(glab.slice(0, 4), ["mr", "list", "--source-branch", "feature/ABC-1-x"]);
  assert.ok(glab.includes("json"));
});

test("parsePrList normaliza gh y glab a la misma forma", () => {
  const gh = parsePrList("gh", JSON.stringify([{ number: 7, url: "https://gh/pr/7", title: "T", baseRefName: "main" }]));
  assert.deepEqual(gh, { number: 7, url: "https://gh/pr/7", title: "T", base: "main" });

  const glab = parsePrList("glab", JSON.stringify([{ iid: 12, web_url: "https://gl/mr/12", title: "T", target_branch: "testing", state: "opened" }]));
  assert.deepEqual(glab, { number: 12, url: "https://gl/mr/12", title: "T", base: "testing" });
});

test("parsePrList ignora las cerradas/mergeadas: reabrir una MR mergeada no lo pidió nadie", () => {
  const j = JSON.stringify([
    { iid: 3, state: "merged", web_url: "u", target_branch: "main" },
    { iid: 4, state: "closed", web_url: "u", target_branch: "main" },
  ]);
  assert.equal(parsePrList("glab", j), null);
});

test("parsePrList: lista vacía o salida vacía → null (no hay PR abierta)", () => {
  assert.equal(parsePrList("gh", "[]"), null);
  assert.equal(parsePrList("gh", "   "), null);
  assert.equal(parsePrList("gh", undefined), null);
});

test("updatePrCmd: gh lee el body de un archivo, glab lo manda como string", () => {
  const gh = updatePrCmd("gh", { number: 7, title: "T", body: "B", bodyFile: "/tmp/b.md" });
  assert.deepEqual(gh, ["pr", "edit", "7", "--title", "T", "--body-file", "/tmp/b.md"]);
  const glab = updatePrCmd("glab", { number: 12, title: "T", body: "B", bodyFile: "/tmp/b.md" });
  assert.deepEqual(glab, ["mr", "update", "12", "--title", "T", "--description", "B", "--yes"]);
});

test("isAlreadyExistsError reconoce las frases de gh y glab", () => {
  assert.ok(isAlreadyExistsError("a merge request already exists for this branch"));
  assert.ok(isAlreadyExistsError('a pull request for branch "x" into branch "main" already exists'));
  assert.ok(!isAlreadyExistsError("could not find remote"));
  assert.ok(!isAlreadyExistsError(""));
});

test("describeUpdate avisa cuando la PR abierta apunta a otra base", () => {
  const lines = describeUpdate({ number: 12, url: "u", base: "main" }, { base: "testing", tool: "glab" }).join("\n");
  assert.match(lines, /#12/);
  assert.match(lines, /apunta a 'main'/);
  assert.match(lines, /ACTUALIZAR/);
});

test("describeUpdate no inventa un conflicto de base cuando coinciden", () => {
  const lines = describeUpdate({ number: 3, url: "u", base: "develop" }, { base: "develop", tool: "gh" }).join("\n");
  assert.doesNotMatch(lines, /apunta a/);
});
