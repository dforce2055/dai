import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRemote, detectForge, repoWebUrl, branchUrl, commitUrl } from "../lib/forge-url.mjs";

test("parsea remoto SSH scp-like", () => {
  assert.deepEqual(parseRemote("git@github.com:org/frontend.git"),
    { host: "github.com", path: "org/frontend" });
});

test("parsea remoto HTTPS", () => {
  assert.deepEqual(parseRemote("https://github.com/org/frontend.git"),
    { host: "github.com", path: "org/frontend" });
});

test("parsea remoto ssh:// con puerto", () => {
  assert.deepEqual(parseRemote("ssh://git@gitlab.acme.com:2222/grupo/repo.git"),
    { host: "gitlab.acme.com", path: "grupo/repo" });
});

test("detecta el forge por host", () => {
  assert.equal(detectForge("github.com"), "github");
  assert.equal(detectForge("gitlab.acme.com"), "gitlab");
  assert.equal(detectForge("bitbucket.org"), "bitbucket");
  assert.equal(detectForge("git.interno.corp"), "github"); // default
});

test("repo web url normaliza .git", () => {
  assert.equal(repoWebUrl("git@github.com:org/repo.git"), "https://github.com/org/repo");
});

test("branch url es específica del forge", () => {
  assert.equal(branchUrl("git@github.com:org/repo.git", "feature/ABC-482-x"),
    "https://github.com/org/repo/tree/feature/ABC-482-x");
  assert.equal(branchUrl("git@gitlab.acme.com:g/r.git", "main"),
    "https://gitlab.acme.com/g/r/-/tree/main");
});

test("commit url es específica del forge", () => {
  assert.equal(commitUrl("https://github.com/org/repo.git", "abc123"),
    "https://github.com/org/repo/commit/abc123");
  assert.equal(commitUrl("git@bitbucket.org:t/r.git", "abc123"),
    "https://bitbucket.org/t/r/commits/abc123");
});

test("remoto inválido devuelve null, no rompe", () => {
  assert.equal(parseRemote(""), null);
  assert.equal(repoWebUrl("no-es-un-remoto"), null);
});
