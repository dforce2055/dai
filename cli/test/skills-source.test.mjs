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

test("parseSource reconoce un paquete npm (npm:@scope/pkg[@version])", () => {
  assert.deepEqual(parseSource("npm:@scope/ui-skills"),
    { type: "npm", location: "@scope/ui-skills", ref: null });
  // la versión va en el spec (@x.y.z), no como ref con '#'
  assert.deepEqual(parseSource("npm:@scope/ui-skills@1.2.3"),
    { type: "npm", location: "@scope/ui-skills@1.2.3", ref: null });
  assert.deepEqual(parseSource("npm:paquete-suelto"),
    { type: "npm", location: "paquete-suelto", ref: null });
});

test("parseSource: npm: sin spec explota (no lo confunde con path)", () => {
  assert.throws(() => parseSource("npm:"), /npm/);
});

test("parseSource rechaza la fuente vacía", () => {
  assert.throws(() => parseSource(""), /vac/);
  assert.throws(() => parseSource(null), /vac/);
});
