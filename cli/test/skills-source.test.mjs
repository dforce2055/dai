import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSource } from "../lib/skills-source.mjs";

test("parseSource clasifica git URL vs path local y separa el ref (ADR-0013)", () => {
  assert.deepEqual(parseSource("github.com/org/skills"),
    { type: "git", location: "https://github.com/org/skills", ref: null });
  assert.deepEqual(parseSource("https://github.com/org/skills#v2"),
    { type: "git", location: "https://github.com/org/skills", ref: "v2" });
  assert.deepEqual(parseSource("git@github.com:org/skills.git"),
    { type: "git", location: "git@github.com:org/skills.git", ref: null });
  assert.deepEqual(parseSource("../mis-skills"),
    { type: "path", location: "../mis-skills", ref: null });
  assert.deepEqual(parseSource("/abs/skills#main"),
    { type: "path", location: "/abs/skills", ref: "main" });
});

test("parseSource rechaza la fuente vacía", () => {
  assert.throws(() => parseSource(""), /vac/);
  assert.throws(() => parseSource(null), /vac/);
});
