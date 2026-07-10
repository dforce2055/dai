import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVersion, compareVersions, versionDrift } from "../lib/semver.mjs";

test("parseVersion parsea X.Y.Z y rechaza basura", () => {
  assert.deepEqual(parseVersion("0.3.1"), { major: 0, minor: 3, patch: 1 });
  assert.deepEqual(parseVersion(" 1.20.300 "), { major: 1, minor: 20, patch: 300 });
  assert.equal(parseVersion("no"), null);
  assert.equal(parseVersion(undefined), null);
});

test("compareVersions ordena por major, minor, patch", () => {
  assert.equal(compareVersions("0.3.0", "0.3.1"), -1);
  assert.equal(compareVersions("0.4.0", "0.3.9"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
  assert.equal(compareVersions("x", "1.0.0"), null);
});

test("versionDrift clasifica el estado repo vs CLI", () => {
  assert.equal(versionDrift("0.3.1", "0.3.1"), "current");
  assert.equal(versionDrift("0.3.0", "0.3.9"), "minor-behind");   // misma major, CLI adelante
  assert.equal(versionDrift("0.9.0", "1.0.0"), "major-behind");   // major distinta
  assert.equal(versionDrift("0.4.0", "0.3.1"), "cli-behind");     // repo más nuevo que el CLI
  assert.equal(versionDrift("?", "0.3.1"), "unknown");
});
