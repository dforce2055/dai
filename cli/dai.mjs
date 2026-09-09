#!/usr/bin/env node
// dai · CLI de acciones deterministas de la metodología (ADR-0002, capa 2).
// Lo mecánico vive acá, no en la inteligencia del asistente: así el output es
// idéntico con Claude, con Copilot, o sin ningún asistente.
//
// Uso:
//   dai ac-hash <us.md>           Calcula el ac_hash de una US (ADR-0001). Sin archivo, stdin.
//   dai ls [--json] [--root <d>]  Lista las US que implementa el repo (ADR-0005).
//   dai link-us <KEY> --us <md>   Crea branch + implements.yaml atados al KEY (ADR-0004).
//       [--repo r] [--change c] [--title t] [--autor a] [--base b] [--dry-run]
//   dai version
//
// El link del tracker sale de DAI_TRACKER_URL_TEMPLATE (p. ej. "https://jira/browse/{id}").

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync, cpSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename, relative } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { acHash } from "./lib/ac-hash.mjs";
import { discoverImplements, isPlaceholderId } from "./lib/implements.mjs";
import { isValidKey, slugify, branchName, extractTitle, renderImplementsYaml } from "./lib/link-us.mjs";
import { loadDaiEnv } from "./lib/env.mjs";
import { getAdapter, coverageStatus, statusLabel, fetchLiveUS } from "./lib/pm-adapter.mjs";
import { branchUrl, commitUrl, parseRemote, detectForge } from "./lib/forge-url.mjs";
import { parsePrRef, getPR, postComment, postReview } from "./lib/forge-api.mjs";
import { trackerUrl } from "./lib/tracker-url.mjs";
import { parseFindings, diffPositions, validateFindings, filterFindings, renderFindingBody, renderReviewSummary } from "./lib/review-findings.mjs";
import { composePrBody, prTitle, forgeTool, bodyGaps } from "./lib/pr.mjs";
import { resolveBase, isProdBranch, branchFlow, baseHint, parseOriginHead } from "./lib/branch-flow.mjs";
import { listPrCmd, parsePrList, updatePrCmd, updatePrApiCmd, isAlreadyExistsError, describeUpdate } from "./lib/pr-remote.mjs";
import { parseCommitLog, proposeBump, nextVersion, buildManifest, renderManifest, BUMP_CAVEAT } from "./lib/release-plan.mjs";
import { bumpPackageJson, bumpVersionFile, changelogEntry, insertChangelogEntry, changelogSection, changelogGaps, releaseBranch, tagName, normalizeVersion } from "./lib/release-files.mjs";
import { notifyConfig, describeTarget, renderNotice, sendNotice, formatFecha } from "./lib/notify.mjs";
import { releaseMarker, alreadyStamped, renderReleaseStamp, stampPlan, renderStampPlan, stampWarning, SIN_ESTAMPAR } from "./lib/release-stamp.mjs";
import { parseImplements } from "./lib/implements.mjs";
import { absolutizeSiteLinks } from "./lib/docs-links.mjs";
import { diagnoseGitSsh, pushFailureHint, WINDOWS_OPENSSH } from "./lib/git-ssh.mjs";
import { dirsEqual } from "./lib/fsutil.mjs";
import { parseFlags, parseAssistants, isAssistantToken, asList } from "./lib/args.mjs";
import { versionDrift, planUpgrade, compareVersions } from "./lib/semver.mjs";
import { parseSource } from "./lib/skills-source.mjs";
import { skillToCursor, validateSkill, constitution, constitutionCursorRule, envFor, mergeEnv, upsertBlock, reconcileGitignore, stalePromptFiles, opsxHint, opsxCommand, OPSX_COMMAND_FILE, OPENSPEC_TOOL, OPENSPEC_MIN } from "./lib/bootstrap.mjs";
import { parseFieldsFile, parseFieldOverrides, resolveJiraFields } from "./lib/jira-fields.mjs";
import { assertProjectKey } from "./lib/pm-jira.mjs";
import { flattenImplements, stampScope, prScope, matchBranchToImplements, requiresLink, trackerKeysIn } from "./lib/branch-scope.mjs";
import { describeForgeError, parseForgeError } from "./lib/forge-api.mjs";
import { validateUS, renderValidation, parseSpecVersion, bumpSpecVersion, setSpecVersion, PENDING_VERSION } from "./lib/us-format.mjs";
import { isHelpToken, wantsHelp, helpTopic, helpFor, globalUsage } from "./lib/help.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// No crashear si la salida se pipea a algo que cierra temprano (p. ej. `| head`).
process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(0); throw e; });

function fail(msg, code = 1) { process.stderr.write("dai: " + msg + "\n"); process.exit(code); }

// Igual que fail(), pero sin process.exit(). Lo usan los `.catch()` del dispatcher: ahí el
// comando YA terminó, así que cortar de una no aporta nada y en Windows cuesta caro — salir
// de golpe después de un fetch (o de un spawn de npm) aborta el proceso con un assert de
// libuv y tapa el mensaje de error con un stack de C. Ver la nota en cmdCheckCi.
// Adentro de un comando `fail()` sigue siendo lo correcto: ahí sí hay que no volver.
function failSoft(msg, code = 1) { process.stderr.write("dai: " + msg + "\n"); process.exitCode = code; }
const ok = (m) => process.stdout.write(`✓ ${m}\n`);
const info = (m) => process.stdout.write(`› ${m}\n`);
const warn = (m) => process.stdout.write(`⚠ ${m}\n`);
// Color ANSI mínimo — solo si es TTY y no está NO_COLOR (así no ensucia pipes/CI).
const _color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, m) => (_color ? `\x1b[${code}m${m}\x1b[0m` : m);
const C = { y: (m) => paint("33", m), r: (m) => paint("31", m), cy: (m) => paint("36", m), b: (m) => paint("1", m), dim: (m) => paint("2", m) };
const ROOT = join(HERE, "..");            // raíz del paquete dai (cli/ está adentro)
// Rutas relativas al cwd en la salida: una ruta absoluta de 120 caracteres no se lee ni
// se copia. Si el archivo está fuera del cwd (`../otro`), se muestra tal cual.
const rel = (p) => { const r = relative(process.cwd(), p); return !r || r.startsWith("..") ? p : r; };

// Banner de bienvenida de `dai init`: el Sol de Mayo en bloques (cuerpo y rayos rectos en
// oro; rayos ondulados en celeste) al lado del título, más el preview de lo que se configura.
// Todo con caracteres — cero-dep. Degrada a ASCII sin color si no hay TTY o con NO_COLOR.
const initBanner = () => {
  const sun = [
    "     █     ",
    " ▒ ▄███▄ ▒ ",
    "██ █████ ██",
    " ▒ ▀███▀ ▒ ",
    "     █     ",
  ];
  const paintSun = (line) => [...line].map((ch) => (ch === "▒" ? C.cy(ch) : ch === " " ? " " : C.y(ch))).join("");
  const aside = ["", paint("1;33", "dai") + " · Desarrollo Asistido por IA", C.dim("La IA asiste; la persona firma."), "", ""];
  let out = "\n";
  for (let i = 0; i < sun.length; i++) out += "  " + paintSun(sun[i]) + (aside[i] ? "    " + aside[i] : "") + "\n";
  out += "\n  " + C.b("Esto va a configurar el repo:") + "\n";
  for (const b of [
    "Skills del método (grill · link-us · tdd · dai-review) en tu asistente",
    "La constitución del proyecto — las reglas del trabajo",
    "OpenSpec para el CÓMO (design / tasks) — opcional",
    "Plantilla de PR + .env.dai para el tracker",
  ]) out += "    " + C.cy("▸") + " " + b + "\n";
  return out;
};
const CLAUDE_SKILLS_DIR = process.env.CLAUDE_SKILLS_DIR || join(homedir(), ".claude", "skills");
const CURSOR_SKILLS_DIR = process.env.CURSOR_SKILLS_DIR || join(homedir(), ".cursor", "skills");
// Copilot lee las skills personales de ~/.copilot/skills (NO de ~/.claude/skills, que
// solo mira VS Code). Por eso una skill "instalada global" no le aparecía (ADR-0014).
const COPILOT_SKILLS_DIR = process.env.COPILOT_SKILLS_DIR || join(homedir(), ".copilot", "skills");
function git(args, opts = {}) {
  // stderr en 'pipe' (no 'inherit') para no filtrar errores de git a la salida;
  // quedan en e.stderr para quien quiera inspeccionarlos.
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}
// En Windows los binarios instalados por npm (npm, openspec) son shims `.cmd`. Desde
// Node 18.20 / 20.12 / 21.7 (fix de CVE-2024-27980) execFileSync se NIEGA a lanzar un
// `.cmd` salvo con shell:true — si no, tira EINVAL, que dai confundía con "sin red".
// Por eso van con shell en Windows. git/gh/glab son `.exe`: se resuelven normal, sin shell.
function runNpmTool(name, args, opts = {}) {
  const win = process.platform === "win32";
  return execFileSync(win ? `${name}.cmd` : name, args, { shell: win, ...opts });
}
// La URL de la US: template > canónica del tracker > derivada del backend > null.
// Nunca el id pelado: ver el porqué en lib/tracker-url.mjs.
const usUrlFor = (id, liveUrl = null) => trackerUrl(id, { env: process.env, liveUrl });

// ── ac-hash ─────────────────────────────────────────────────────────────────
function cmdAcHash(arg) {
  const md = arg ? readFileSync(arg, "utf8") : readFileSync(0, "utf8");
  const h = acHash(md);
  if (h == null) fail("la US no tiene un bloque 'Criterios de aceptación' (criterios testeables bajo '## Criterios de aceptación').", 2);
  process.stdout.write(h + "\n");
}

// ── ls ──────────────────────────────────────────────────────────────────────
function cmdLs(opts) {
  const root = opts.root || process.cwd();
  const found = discoverImplements(root, { includeArchived: false });
  const rows = [];
  for (const f of found) {
    for (const im of f.implements || []) {
      if (isPlaceholderId(im.id)) continue;   // saltea plantillas sin completar
      rows.push({ change: f.change, repo: f.repo, id: im.id, version: im.version,
                  ac_hash: im.ac_hash, link: usUrlFor(im.id) });
    }
  }
  if (opts.json) { process.stdout.write(JSON.stringify(rows, null, 2) + "\n"); return; }
  if (rows.length === 0) { process.stdout.write("No hay implements.yaml en " + root + "\n"); return; }
  // Ancho de la columna CHANGE adaptado al contenido (mín 8, máx 40).
  const cw = Math.min(40, Math.max(8, ...rows.map((r) => String(r.change ?? "").length)));
  const w = (s, n) => { const t = String(s ?? ""); return (t.length > n ? t.slice(0, n - 1) + "…" : t).padEnd(n); };
  const pad = (s, n) => String(s ?? "").padEnd(n);
  process.stdout.write(pad("CHANGE", cw + 2) + pad("US", 12) + pad("VER", 6) + pad("AC_HASH", 11) + "LINK\n");
  for (const r of rows) {
    process.stdout.write(w(r.change, cw) + "  " + pad(r.id, 12) + pad(r.version, 6) + pad(r.ac_hash, 11) + (r.link || "") + "\n");
  }
  const repo = rows[0]?.repo ? ` en ${rows[0].repo}` : "";
  process.stdout.write(`${rows.length} US implementada(s)${repo}\n`);
}

// ── link-us ───────────────────────────────────────────────────────────────────
async function cmdLinkUs(key, opts) {
  if (!isValidKey(key)) fail(`key inválido: '${key}'. Sin espacios ni barras (ej.: ABC-482 o 86cxyz).`, 1);

  let title, hash, version = null;
  if (opts.us) {
    // Fuente local: un .md con la US.
    const md = readFileSync(opts.us, "utf8");
    hash = acHash(md);
    if (hash == null) fail(`la US en ${opts.us} no tiene una sección 'Criterios de aceptación' con criterios testeables → sin ac_hash.\n  Agregá los criterios bajo '## Criterios de aceptación', o corré /grill-user-story para pulir la US.`, 2);
    title = opts.title || extractTitle(md);
    version = parseSpecVersion(md);
  } else {
    // Fuente tracker: traer la US del adaptador (mismo hash que usará `dai check`).
    loadDaiEnv();
    const adapter = getAdapter(process.env);
    const us = await adapter.fetchUS(key);
    if (!us) fail(`no encontré la US ${key} en el backend ${adapter.kind}. Pasa --us <md> o revisa el .env.dai.`, 2);
    hash = us.ac_hash;
    if (hash == null) fail(`la US ${key} no tiene una sección 'Criterios de aceptación' con criterios testeables → sin ac_hash, no se puede linkear.\n  Agregá la sección en el tracker, o corré /grill-user-story ${key} para pulir la US (te interroga y la re-publica).`, 2);
    title = opts.title || us.title;
    version = us.spec_version;
  }

  // Sin spec_version NO se inventa un `v1`: ese número se publica en la PR y se estampa en
  // el tracker como si fuera un dato, y `dai check` lo reporta con un ✅ que da por buena
  // una versión que no existe (issue #46). Un placeholder visible dice la verdad.
  if (!version) {
    version = PENDING_VERSION;
    warn(`la US ${key} no declara spec_version — el link queda con 'version: ${PENDING_VERSION}'.`);
    process.stdout.write(`    Agregá la fila 'spec_version | v1' a la metadata de la US y re-estampá:  dai link-us ${key} --resync\n`);
  }

  // ── modo resync: re-estampar el ac_hash en el implements.yaml existente ──────
  if (opts.resync) {
    const target = discoverImplements(process.cwd())
      .find((f) => (f.implements || []).some((im) => im.id === key));
    if (!target) fail(`no encontré un implements.yaml que implemente ${key}. ¿Estás en la branch correcta?`, 1);
    const prev = (target.implements.find((im) => im.id === key) || {}).ac_hash;
    if (prev === hash) { ok(`${key} ya estaba al día (${hash}). Nada que resincronizar.`); return; }
    let txt = readFileSync(target.path, "utf8");
    txt = txt.replace(/^(\s*ac_hash:\s*).*$/m, `$1${hash}`).replace(/^(\s*version:\s*).*$/m, `$1${version}`);
    if (opts.dryRun) { process.stdout.write(`[dry-run] ${target.path}: ac_hash ${prev} → ${hash} (version ${version})\n`); return; }
    writeFileSync(target.path, txt);
    ok(`${key} resincronizado: ac_hash ${prev} → ${hash} (${version}) en ${target.path}`);
    warn("revisa si tu implementación cubre el criterio nuevo, y ejecuta tus tests.");
    return;
  }

  if (!title) fail("no pude extraer el título de la US; pasa --title.", 1);
  const branch = branchName(key, title);
  const change = opts.change || slugify(title);
  const repo = opts.repo || gitRepoName() || basename(process.cwd());
  const autor = opts.autor || gitUser() || "<dev>";
  const yamlPath = join("openspec", "changes", change, "implements.yaml");
  const yaml = renderImplementsYaml({ change, repo, id: key, version, ac_hash: hash, autor });

  if (opts.dryRun) {
    process.stdout.write(`[dry-run]\n  branch:  ${branch}\n  archivo: ${yamlPath}\n  ac_hash: ${hash}\n\n${yaml}`);
    return;
  }
  // Efectos: crear branch + escribir el implements.yaml
  const base = opts.base ? [opts.base] : [];
  try { git(["checkout", "-b", branch, ...base]); }
  catch (e) { fail(`no pude crear la branch '${branch}': ${String(e.message).split("\n")[0]}`, 1); }
  if (existsSync(yamlPath)) fail(`ya existe ${yamlPath} — no lo piso.`, 1);
  mkdirSync(dirname(yamlPath), { recursive: true });
  writeFileSync(yamlPath, yaml);
  process.stdout.write(`✓ branch:  ${branch}\n✓ archivo: ${yamlPath}  (ac_hash ${hash})\n`);
}

function gitRepoName() {
  try { return basename(git(["remote", "get-url", "origin"])).replace(/\.git$/, ""); }
  catch { return null; }
}
function gitUser() {
  try { return git(["config", "user.name"]); } catch { return null; }
}
function gitRemote() { try { return git(["remote", "get-url", "origin"]); } catch { return null; } }
function gitBranch() { try { return git(["rev-parse", "--abbrev-ref", "HEAD"]); } catch { return null; } }
function gitCommit() { try { return git(["rev-parse", "HEAD"]); } catch { return null; } }
// ¿Existe esta ref como commit? Devuelve la ref si sí, null si no. Sirve para caer de
// `main` a `origin/main` sin adivinar: en muchos repos la base solo existe en el remoto.
function resolveRev(ref) {
  try { git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]); return ref; } catch { return null; }
}
// La rama default del remoto (`origin/HEAD`). Es mejor fallback que un `main` fijo, pero
// sigue siendo un fallback: en un repo con ramas de ambiente, la default del remoto suele
// ser justo la de producción. Por eso el preview siempre dice de dónde salió la base.
function originHeadBranch() {
  try { return parseOriginHead(git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"])); }
  catch { return null; }
}

// Un texto que se puede pasar inline (`--description "…"`) o por archivo
// (`--description-file notas.md`). Un agente casi siempre quiere el archivo: markdown
// multilínea no sobrevive entero a la línea de comandos.
function textOpt(opts, name) {
  const file = opts[`${name}File`];
  if (file !== undefined) {
    if (file === true) fail(`--${name}-file necesita la ruta de un archivo.`, 1);
    const path = Array.isArray(file) ? file[file.length - 1] : file;
    try { return readFileSync(path, "utf8"); }
    catch { fail(`no pude leer --${name}-file '${path}'.`, 1); }
  }
  const v = opts[name];
  if (v === true) fail(`--${name} necesita un texto (o usá --${name}-file <archivo>).`, 1);
  if (Array.isArray(v)) return v.join("\n");
  return typeof v === "string" ? v : null;
}

// ── check --ci: el gate de governance/ci-rules.md, ejecutable ────────────────
//
// La brecha del issue #26: ci-rules.md prometía "sin implements.yaml el CI bloquea",
// pero no existía el comando que lo hiciera. Era una regla escrita que nadie aplicaba.
//
// Lo que NO hace: exigirle US a todo. Una `chore/` o una `fix/` sin ticket son trabajo
// legítimo (branch-naming.md), y un gate que las bloquea se desactiva a la semana.
// Quién decide es requiresLink(), leyendo el nombre de la branch.
//
// Salidas:  0 = pasa · 1 = falta el link · 2 = hay link pero el QUÉ cambió (atrasado)
//
// El código de salida se fija con `process.exitCode`, NO con `process.exit()`. En Windows,
// salir de golpe justo después de un fetch aborta el proceso con un assert de libuv
// (`!(handle->flags & UV_HANDLE_CLOSING)`, src\win\async.c) mientras undici todavía está
// desarmando sus handles. El gate imprimía "al día" y devolvía distinto de cero igual: un
// verde reportado como rojo en CI o en un hook. Dejar que el loop drene solo cuesta ~40ms
// (los sockets keep-alive de undici están unref'd) y no cambia nada en macOS/Linux.
async function cmdCheckCi(opts = {}) {
  const branch = opts.branch || process.env.DAI_CI_BRANCH || ciBranch() || gitBranch();
  const { required, reason } = requiresLink(branch);
  const rows = flattenImplements(discoverImplements(process.cwd(), { includeArchived: false }));

  info(`branch '${branch || "(desconocida)"}' — ${reason}`);
  if (!required) {
    if (rows.length) info(`igual declara ${rows.length} US (${rows.map((r) => r.id).join(", ")}) — se chequea su cobertura.`);
    else { ok("gate OK — esta branch no requiere US."); return; }
  }
  if (required && rows.length === 0) {
    const ids = trackerKeysIn(branch);
    process.stderr.write(
      "✗ gate: falta el link QUÉ↔CÓMO — esta branch no tiene implements.yaml.\n" +
      `    Crealo:  dai link-us ${ids[0] || "<ID-DE-LA-US>"}\n` +
      "    Si NO implementa una US (tooling, deps, docs), renombrá la branch con un\n" +
      "    prefijo exento — chore/, docs/, ci/ — según governance/branch-naming.md.\n");
    process.exitCode = 1; return;
  }

  // Hay link: que además esté al día contra la US viva. Sin token/backend eso no se
  // puede saber, y un gate que bloquea por falta de red es un gate que se apaga:
  // con --no-network (o sin adaptador utilizable) valida el link y no más.
  if (opts.noNetwork) {
    ok(`gate OK — ${rows.length} US linkeada(s): ${rows.map((r) => r.id).join(", ")} (--no-network: no se comparó contra la US viva).`);
    process.exitCode = 0; return;
  }
  loadDaiEnv();
  let adapter;
  try { adapter = getAdapter(process.env); }
  catch (e) {
    warn(`no puedo comparar contra la US viva: ${e.message}`);
    ok(`gate OK igual — el link existe (${rows.map((r) => r.id).join(", ")}). Configurá el backend para chequear también el atraso.`);
    process.exitCode = 0; return;
  }
  let worst = 0;
  for (const r of rows) {
    let live = null, netErr = null;
    try { live = await adapter.fetchUS(r.id); } catch (e) { netErr = String(e.message).split("\n")[0]; }
    if (netErr) { warn(`${r.id}: no pude leer la US (${netErr}) — no bloqueo por un problema de red/credencial.`); continue; }
    const status = coverageStatus(r.ac_hash, live?.ac_hash);
    if (status === "al-dia") { ok(`${r.id} al día (${r.version})`); versionDriftHint(r, live); }
    else if (status === "atrasado") {
      process.stderr.write(`✗ gate: ${r.id} ATRASADO — implementaste ${r.ac_hash}, la US viva es ${live.ac_hash}.\n` +
        `    El QUÉ cambió. Resincronizá y revisá que lo cubras:  dai link-us ${r.id} --resync\n`);
      worst = Math.max(worst, 2);
    } else {
      warn(`${r.id}: no encontré la US en ${adapter.kind} — el link apunta a un ID que el tracker no tiene.`);
      worst = Math.max(worst, 2);
    }
  }
  if (worst === 0) ok(`gate OK — ${rows.length} US linkeada(s) y al día.`);
  process.exitCode = worst;
}

// La branch real en CI: en una PR, HEAD es un merge commit detached, así que
// `git rev-parse --abbrev-ref HEAD` devuelve "HEAD" y no el nombre. Cada forge la
// expone en su propia variable.
function ciBranch() {
  const e = process.env;
  return e.GITHUB_HEAD_REF || e.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME || e.CI_COMMIT_REF_NAME ||
    e.BITBUCKET_BRANCH || e.BUILD_SOURCEBRANCHNAME ||
    (e.GITHUB_REF_NAME && !/^\d+\/merge$/.test(e.GITHUB_REF_NAME) ? e.GITHUB_REF_NAME : null) || null;
}

// El ac_hash dice si el QUÉ cambió; el `version` del link es el número que se PUBLICA
// (en el body de la PR, en el stamp del tracker). Que coincidan no es cosmético: un link
// al día con `version: v1` contra una US en v4 estampa una versión que no existe, y el ✅
// lo hace pasar por verificado (issue #46). No cambia el exit code — el hash manda.
function versionDriftHint(im, live) {
  const declared = String(im?.version ?? "").trim();
  const real = String(live?.spec_version ?? "").trim();
  if (!real || declared === real) return;
  warn(`${im.id}: el link declara version '${declared || "(vacío)"}' y la US viva dice '${real}'.`);
  process.stdout.write(`    Ese número se publica en la PR y se estampa en el tracker. Corregilo:  dai link-us ${im.id} --resync\n`);
}

// ── check ──────────────────────────────────────────────────────────────────
// `process.exitCode` en vez de `process.exit()`: ver la nota en cmdCheckCi.
async function cmdCheck() {
  loadDaiEnv();
  const adapter = getAdapter(process.env);
  const found = discoverImplements(process.cwd(), { includeArchived: false });
  let worst = 0, n = 0;
  const atrasadas = [];
  for (const f of found) for (const im of f.implements || []) {
    if (isPlaceholderId(im.id)) continue;   // plantilla sin completar, no es una US real
    n++;
    const { us: live, unreachable, reason } = await fetchLiveUS(adapter, im.id);
    const status = coverageStatus(im.ac_hash, live?.ac_hash, { unreachable });
    if (status === "al-dia") {
      process.stdout.write(`✅ ${im.id} al día (${im.version})\n`);
      versionDriftHint(im, live);
    }
    else if (status === "atrasado") {
      process.stdout.write(`⚠️  ${im.id} ATRASADO: implementaste ${im.ac_hash}, la US viva es ${live.ac_hash}${live.spec_version ? ` (${live.spec_version})` : ""}\n`);
      atrasadas.push(im.id);
      worst = Math.max(worst, 1);
    } else if (status === "sin-respuesta") {
      // No es "no hay US": es "no pude preguntar". Antes moría acá con `fetch failed` y sin
      // chequear las demás; ahora lo dice, sigue, y sale ≠ 0 porque no pudo verificar nada.
      process.stdout.write(`⚠️  ${reason}\n`);
      worst = Math.max(worst, 2);
    } else {
      process.stdout.write(`❓ ${im.id}: no encontré la US (backend ${adapter.kind}). ¿Falta el .md o el token?\n`);
      worst = Math.max(worst, 2);
    }
  }
  if (n === 0) process.stdout.write("No hay implements.yaml para chequear.\n");
  if (atrasadas.length) {
    process.stdout.write("\n  El QUÉ cambió desde que lo implementaste. Para resincronizar:\n");
    for (const id of atrasadas) process.stdout.write(`    dai link-us ${id} --resync     # re-estampa el ac_hash contra la US viva\n`);
    process.stdout.write("  Después, revisa si tu implementación cubre el criterio nuevo.\n");
  }
  process.exitCode = worst;
}

// ── stamp ──────────────────────────────────────────────────────────────────
// Estampa la cobertura de UNA US: la de esta branch. Antes recorría todo el repo
// —archivados incluidos— así que cerrar una US le dejaba un comentario a las cuatro
// del sprint (issue #22). Ahora decide con branch-scope.mjs y, si no puede saber cuál,
// PREGUNTA en vez de estampar de más: un comentario en el tracker no se deshace.
async function cmdStamp(ids = [], opts = {}) {
  loadDaiEnv();
  const adapter = getAdapter(process.env);
  const remote = gitRemote(), branch = gitBranch(), commit = gitCommit();
  const rows = flattenImplements(discoverImplements(process.cwd(), { includeArchived: false }));
  const allRows = flattenImplements(discoverImplements(process.cwd()));
  const scope = stampScope({ branch, rows, allRows, ids, all: !!opts.all });

  if (scope.mode === "none") { process.stdout.write("No hay implements.yaml para estampar.\n"); return; }
  if (scope.mode === "explicit" && scope.missing?.length) {
    fail(`no encontré implements.yaml para: ${scope.missing.join(", ")}.\n` +
         `  US en este repo: ${allRows.map((r) => r.id).join(", ") || "(ninguna)"}`, 1);
  }

  let targets = scope.targets;
  if (scope.mode === "ambiguous") {
    warn(`${scope.reason}.`);
    const listed = scope.candidates.map((r, i) => `    ${i + 1}) ${r.id}  ${C.dim(`(${r.change})`)}`).join("\n");
    process.stdout.write(`  US vivas en el repo:\n${listed}\n`);
    if (opts.yes || !process.stdin.isTTY) {
      fail("no sé cuál estampar. Decilo explícitamente:  dai stamp <ID>   (o `dai stamp --all` para todas).", 1);
    }
    const ans = await askOrCancel("  ¿Cuál estampo? (número, varios con coma, 'a'=todas, Enter=cancelar) ");
    if (!ans) { info("Cancelado — no se estampó nada."); return; }
    if (/^a(ll|)$/i.test(ans)) targets = scope.candidates;
    else {
      const picked = ans.split(/[,\s]+/).filter(Boolean).map((t) => Number(t));
      if (picked.some((n) => !Number.isInteger(n) || n < 1 || n > scope.candidates.length)) {
        fail(`respuesta inválida: '${ans}'. Se esperaba número(s) entre 1 y ${scope.candidates.length}, o 'a'.`, 1);
      }
      targets = picked.map((n) => scope.candidates[n - 1]);
    }
  } else if (scope.mode !== "all") {
    info(`${scope.reason} → estampo ${targets.map((t) => t.id).join(", ")}.`);
  }

  for (const r of targets) {
    // Estampar es ESCRIBIR en el tracker de todo el equipo, y no se deshace: si no se pudo
    // verificar el estado, no se estampa. (Hoy ya frenaba, por la excepción sin atrapar; acá
    // queda explícito, con el motivo, y cubierto por un test.)
    const { us: live, unreachable, reason } = await fetchLiveUS(adapter, r.id);
    if (unreachable) fail(`${reason}\n  No estampo un estado que no pude verificar.`, 2);
    const status = coverageStatus(r.ac_hash, live?.ac_hash);
    const record = {
      repo: r.repo, change: r.change, version: r.version, ac_hash: r.ac_hash, status,
      branch, branchUrl: branchUrl(remote, branch), commit, commitUrl: commitUrl(remote, commit),
    };
    const where = await adapter.stamp(r.id, record);
    process.stdout.write(`✓ ${r.id} → ${where}  (${statusLabel(status)})\n`);
  }
  if (targets.length === 0) process.stdout.write("No se estampó nada.\n");
}

// ── forge (review) ───────────────────────────────────────────────────────────
// El review.json lo escribe la SKILL, no el CLI — así que `dai init`/`dai sync` son los
// únicos que ponían `.dai/reviews/` en el .gitignore, y un repo inicializado con una dai
// vieja se comía borradores a medio editar en un commit (issue #25). Acá lo arreglamos
// donde duele: al consumir el archivo. Aditivo, y solo si el borrador está bajo
// `.dai/reviews/` — si el equipo decidió versionar sus reviews en otro lado, no opinamos.
function ensureReviewsIgnored(fromPath) {
  const rel = relative(process.cwd(), fromPath).replace(/\\/g, "/");
  if (!rel.startsWith(".dai/reviews/")) return;
  const giPath = join(process.cwd(), ".gitignore");
  if (!existsSync(giPath)) return;               // sin .gitignore no inventamos uno
  const cur = readFileSync(giPath, "utf8");
  const gi = reconcileGitignore(cur, {});        // {} → solo el `ensure` base (.env.dai, .dai/reviews/)
  if (!gi.changed) return;
  writeFileSync(giPath, gi.text.endsWith("\n") ? gi.text : gi.text + "\n");
  info(".gitignore: agregué `.dai/reviews/` — los borradores de review no viajan en un commit.");
  info("            Si tu equipo los quiere versionar, sacá esa línea a mano.");
}

// Una pregunta puntual por TTY. Ctrl+D (EOF) devuelve "" — se trata como "cancelar", no
// como un crash: en un prompt que precede a una acción irreversible, abortar es la
// respuesta más segura, y "Aborted with Ctrl+D" no le dice eso a nadie.
async function askOrCancel(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(q)).trim(); }
  catch { process.stdout.write("\n"); return ""; }
  finally { rl.close(); }
}

// Corre una llamada al forge y, si falla, la traduce a una causa concreta (issue #24)
// en vez del genérico "¿token? ¿ref correcta?".
async function forgeCall(pr, fn) {
  try { return await fn(); }
  catch (e) { fail(describeForgeError(pr, { ...parseForgeError(e), env: process.env }), 1); }
}

async function cmdForge(sub, ref, opts) {
  loadDaiEnv();
  const pr = parsePrRef(ref, gitRemote());
  if (!pr) fail("no pude resolver la PR/MR. Pasa la URL completa o el número (con remoto git).", 1);
  if (sub === "pr") {
    const j = await forgeCall(pr, () => getPR(pr, process.env));
    process.stdout.write(JSON.stringify(j, null, 2) + "\n");
  } else if (sub === "comment") {
    const body = opts.bodyFile ? readFileSync(opts.bodyFile, "utf8") : opts.body;
    if (!body) fail("falta --body-file <archivo> o --body <texto>.", 1);
    const res = await forgeCall(pr, () => postComment(pr, body, process.env));
    process.stdout.write(`✓ comentario posteado${res.url ? `: ${res.url}` : ""}\n`);
  } else if (sub === "review") {
    await cmdForgeReview(pr, opts);
  } else {
    fail("uso: dai forge <pr|comment|review> <ref> [--body-file f | --body t | --from review.json]", 1);
  }
}

// dai forge review <ref> --from review.json [--dry-run | --yes]
//
// El reparto del ADR-0002 en una función: la skill trajo el CRITERIO (el review.json),
// el CLI hace lo MECÁNICO — validar que cada hallazgo apunte al diff de verdad, filtrar,
// y postear. Lo que más valor tiene acá no es postear: es RECHAZAR lo que un LLM inventó
// antes de que el forge conteste 422 sin decir cuál falló.
async function cmdForgeReview(pr, opts) {
  if (!opts.from) fail("falta --from <review.json>. Lo escribe la skill dai-review; revisalo antes de postear.", 1);
  const review = parseFindings(readFileSync(opts.from, "utf8"));
  ensureReviewsIgnored(opts.from);

  // El diff sale de git (local, por SSH), no de la API: es la fuente de verdad de qué
  // línea es comentable, y no gasta rate limit.
  const remote = await forgeCall(pr, () => getPR(pr, process.env));
  const base = opts.base || remote.baseRef;
  if (!base) fail("no pude saber la branch base de la PR. Pasala con --base <branch>.", 1);
  let diff = "";
  try {
    git(["fetch", "origin", base, remote.branch], { stdio: ["inherit", "pipe", "pipe"] });
    diff = git(["diff", `origin/${base}...origin/${remote.branch}`]);
  } catch (e) {
    const err = String(e.stderr || e.message).trim();
    if (/couldn't find remote ref|no such ref/i.test(err)) {
      fail(`la branch '${remote.branch}' ya no está en origin (¿la PR se mergeó y se borró la branch?). ` +
        `Un review inline necesita el diff vivo; sobre una PR cerrada no hay dónde anclar.`, 1);
    }
    fail(`no pude traer el diff de ${base}...${remote.branch}: ${err}`, 1);
  }

  // 1. Validar contra el diff. 2. Filtrar. Nada se cae en silencio: todo se reporta.
  const { valid, rejected } = validateFindings(review.findings, diffPositions(diff));
  const { kept, suppressed } = filterFindings(valid, {
    minSeverity: opts.minSeverity || "low",
    minConfidence: opts.minConfidence ? Number(opts.minConfidence) : 0,
    maxComments: opts.maxComments ? Number(opts.maxComments) : Infinity,
  });

  const body = renderReviewSummary(review, { kept, suppressed, rejected });
  const comments = kept.map((f) => ({ path: f.path, line: f.line, side: f.side, body: renderFindingBody(f) }));

  // ── Preview (acción hacia afuera: se muestra SIEMPRE, se postea solo con --yes) ──
  process.stdout.write(`\n  ── Review a postear en ${remote.url || `#${pr.number}`} ──────────\n`);
  process.stdout.write(`  forge:    ${pr.forge}${pr.forge === "gitlab" ? " (no atómico: son N llamadas)" : " (atómico: 1 llamada)"}\n`);
  process.stdout.write(`  diff:     ${base}...${remote.branch}\n`);
  process.stdout.write(`  hallazgos: ${review.findings.length} en el archivo · ${kept.length} a postear · ${suppressed.length} filtrados · ${rejected.length} descartados\n\n`);
  for (const f of kept) process.stdout.write(`  ✓ ${f.path}:${f.line} [${f.severity}] ${f.body.split("\n")[0].slice(0, 60)}\n`);
  for (const { finding: f, reason } of suppressed) process.stdout.write(`  ~ ${f.path}:${f.line} [${f.severity}] filtrado — ${reason}\n`);
  for (const { finding: f, reason } of rejected) process.stdout.write(`  ✗ ${f.path}:${f.line} [${f.severity}] DESCARTADO — ${reason}\n`);
  process.stdout.write(`\n  ───────────────────────────────────────────────\n${body}\n  ───────────────────────────────────────────────\n`);

  if (rejected.length) {
    warn(`${rejected.length} hallazgo(s) NO apuntan al diff y no se postean. Corregí el 'path'/'line' en ${opts.from} o borralos.`);
  }
  if (opts.dryRun) { info("[dry-run] no se posteó nada."); return; }
  if (!opts.yes) {
    info(`Nada posteado. Revisá el preview y, si está bien:  dai forge review ${pr.number} --from ${opts.from} --yes`);
    return;
  }
  if (!kept.length && !review.summary) fail("no hay nada que postear (0 comentarios y resumen vacío).", 1);

  const res = await forgeCall(pr, () => postReview(pr, { body, comments, headSha: remote.headSha, diffRefs: remote.diffRefs }, process.env));
  ok(`review posteado${res.url ? `: ${res.url}` : ""} — ${res.posted} comentario(s) en línea.`);
  if (res.failed.length) {
    warn(`${res.failed.length} comentario(s) NO entraron (gitlab no es atómico: el resumen y el resto SÍ están posteados):`);
    for (const f of res.failed) process.stdout.write(`    ✗ ${f.path}:${f.line} — ${f.error}\n`);
  }
  info("La aprobación la firma un humano: dai comentó, no aprobó (Art. 5).");
}

// ── publish: crea la US en el tracker desde un .md (fallback del MCP) ──────────

// Los campos propios que exige el proyecto, declarados en .dai/jira-fields.json
// (o donde apunte DAI_JIRA_FIELDS_FILE). Sin archivo → {}: un Jira sin campos
// obligatorios publica igual que siempre.
function loadJiraFieldsSpec() {
  const path = process.env.DAI_JIRA_FIELDS_FILE || join(".dai", "jira-fields.json");
  if (!existsSync(path)) return {};
  return parseFieldsFile(readFileSync(path, "utf8"), path);
}

async function cmdPublish(file, opts = {}) {
  if (!file) fail("uso: dai publish <archivo-us.md> [--parent KEY] [--issuetype T] [--field alias=valor]", 1);
  loadDaiEnv();
  const md = readFileSync(file, "utf8");
  const title = extractTitle(md);
  if (!title) fail("no pude extraer el título de la US (falta un '# Título').", 1);
  const adapter = getAdapter(process.env);
  if (typeof adapter.createUS !== "function") fail(`el backend '${adapter.kind}' no soporta crear US.`, 1);

  const parent = typeof opts.parent === "string" ? opts.parent : undefined;
  const issuetype = typeof opts.issuetype === "string" ? opts.issuetype : undefined;
  const project = typeof opts.project === "string" ? opts.project : undefined;

  // Los campos propios son cosa de Jira; los otros backends no los usan.
  let fields;
  if (adapter.kind === "jira") {
    const type = issuetype || process.env.DAI_JIRA_ISSUETYPE || "Story";
    fields = resolveJiraFields({
      spec: loadJiraFieldsSpec(),
      issuetype: type,
      overrides: parseFieldOverrides(asList(opts.field)),
    });
  } else if (opts.field !== undefined) {
    fail(`--field es solo para jira (DAI_PM=${adapter.kind}).`, 2);
  }

  const r = await adapter.createUS({ title, descriptionMarkdown: md, parent, issuetype, project, fields });
  ok(`US publicada en ${adapter.kind}: ${r.id}${r.url ? `  →  ${r.url}` : ""}`);
  if (parent) info(`colgada de ${parent}`);
  info(`Próximo paso (el dev abre el CÓMO):  dai link-us ${r.id}`);
}

// ── edit-us / update-us: el QUÉ cambia y el tracker se entera ────────────────
//
// Dos puertas de entrada a UN camino. La diferencia es de dónde sale el markdown:
//
//   dai edit-us <ID>    trae la US del tracker → la abrís en tu editor → valida → empuja
//   dai update-us <ID>  ya tenés el .md escrito (lo refinaste implementando) → empuja
//
// El tramo compartido —validar, mostrar el diff, proponer el bump de spec_version,
// confirmar, escribir, re-estampar el ac_hash local— es `pushUS`. No es código duplicado
// con dos nombres: es un solo camino con dos entradas, y por eso las dos puertas dan
// exactamente el mismo preview y la misma confirmación.

// Los campos propios de Jira, si el proyecto los exige (compartido por las dos puertas).
function fieldsFor(adapter, opts) {
  if (opts.field === undefined) return undefined;
  if (adapter.kind !== "jira") fail(`--field es solo para jira (DAI_PM=${adapter.kind}).`, 2);
  return resolveJiraFields({
    spec: loadJiraFieldsSpec(),
    issuetype: opts.issuetype || process.env.DAI_JIRA_ISSUETYPE || "Story",
    overrides: parseFieldOverrides(asList(opts.field)),
  });
}

// El backend md devuelve SINCRÓNICO (el contrato del adaptador lo permite), así que
// `adapter.fetchUS(id).catch(...)` explotaba con DAI_PM=md. Se normaliza a promesa.
const fetchLive = (adapter, id) => Promise.resolve().then(() => adapter.fetchUS(id)).catch(() => null);

// Valida el formato e imprime el veredicto. Devuelve el resultado; corta si hay errores.
function validateOrFail(md, source, { strict = false } = {}) {
  const v = validateUS(md);
  const lines = renderValidation(v);
  process.stdout.write(`\n  ── formato de la US (${source}) ────────────\n`);
  for (const l of lines) process.stdout.write(l + "\n");
  if (!v.ok) {
    process.stdout.write("\n");
    fail("la US no tiene el formato mínimo para viajar al tracker (ver arriba).\n" +
         "  El molde canónico está en .dai/templates/formato-us.md, y /grill-user-story te interroga hasta llegar a él.", 2);
  }
  if (strict && v.warnings.length) {
    process.stdout.write("\n");
    fail(`--strict: ${v.warnings.length} advertencia(s) y ninguna se puede ignorar en este modo.`, 2);
  }
  return v;
}

// El tramo compartido: preview → spec_version → confirmación → tracker → ac_hash local.
// `md` puede reescribirse acá (el bump de spec_version), por eso devuelve el markdown final.
async function pushUS(id, md, { adapter, file, opts, live }) {
  const validation = validateOrFail(md, rel(file), { strict: !!opts.strict });
  const title = opts.title || validation.title;
  const newHash = acHash(md);

  // ── spec_version: el número COMUNICA, el hash DETECTA (METODOLOGIA §4) ──────
  // Si cambiaron los criterios se PROPONE subirlo, no se impone: dai mirando el hash no
  // distingue un criterio nuevo de un typo corregido, y quien sabe la diferencia es el PO.
  const curVer = parseSpecVersion(md);
  const hashChanged = live?.ac_hash !== newHash;
  let newVer = curVer;
  if (hashChanged && !opts.noBump) {
    const proposed = bumpSpecVersion(curVer);
    if (opts.bump === true || opts.yes) newVer = proposed;
    else if (typeof opts.bump === "string") newVer = opts.bump;
    else if (process.stdin.isTTY) {
      process.stdout.write(`\n  Cambiaron los criterios (ac_hash ${C.dim(live?.ac_hash ?? "ninguno")} → ${C.b(newHash)}).\n`);
      process.stdout.write(`    s = cambio ${C.b("material")}: subo spec_version a ${C.b(proposed)} y los repos con ${curVer || "la versión vieja"} se marcan ATRASADOS\n`);
      process.stdout.write(`    n = cambio ${C.b("editorial")} (typo, redacción): se queda en ${curVer || "(sin versión)"}\n`);
      const ans = await askOrCancel(`  ¿Subo spec_version a ${proposed}? (S/n) `);
      if (!/^n/i.test(ans)) newVer = proposed;
    } else {
      // Sin TTY y sin --bump/--no-bump no hay quién decida, y decidir por nuestra cuenta
      // sería inventar la respuesta a la única pregunta que este comando NO puede
      // responder solo. Se deja como está, pero se DICE — un no-op silencioso acá
      // termina en un spec_version que dejó de comunicar nada.
      info(`cambiaron los criterios y spec_version se queda en ${curVer || "(sin versión)"}: no hay TTY para preguntarlo.`);
      info(`  Si el cambio es material:  --bump    (${curVer || "v1"} → ${proposed}, marca atrasados a los repos)`);
      info("  Si es editorial (typo):   --no-bump");
    }
  }
  if (newVer && newVer !== curVer) md = setSpecVersion(md, newVer);

  // ── Preview: qué cambia ALLÁ ARRIBA. Se muestra siempre, antes de escribir nada ──
  // "(ninguno)" también del lado del "sin cambios": imprimir el `null` crudo hace dudar
  // de si el comando se rompió, justo en el preview que la persona lee antes de aprobar.
  const show = (v) => v ?? "(ninguno)";
  const chg = (from, to) => (from === to ? `${show(to)}${C.dim("  (sin cambios)")}` : `${C.dim(show(from))} → ${C.b(show(to))}`);
  process.stdout.write(`\n  ── ${id} · qué cambia en ${adapter.kind} ────────────\n`);
  process.stdout.write(`  título:     ${chg(live?.title, title)}\n`);
  process.stdout.write(`  criterios:  ${validation.criteria.length}\n`);
  process.stdout.write(`  version:    ${chg(curVer, newVer)}\n`);
  process.stdout.write(`  ac_hash:    ${chg(live?.ac_hash, newHash)}\n`);
  process.stdout.write(`  fuente:     ${rel(file)}\n  ──────────────────────────────────────\n`);

  if (opts.dryRun) { info("[dry-run] no se tocó el tracker."); return md; }
  if (!opts.yes && process.stdin.isTTY) {
    const ans = await askOrCancel(`  Esto PISA la US ${id} en ${adapter.kind}. ¿Guardo? (s/N) `);
    if (!/^s|^y/i.test(ans)) { info("Cancelado — el tracker quedó como estaba."); return null; }
  }
  if (md !== readFileSync(file, "utf8")) writeFileSync(file, md);   // el bump también queda local

  const r = await adapter.updateUS(id, { title, descriptionMarkdown: md, fields: fieldsFor(adapter, opts) });
  ok(`${id} actualizada en ${adapter.kind}${r.url ? `  →  ${r.url}` : ""}`);

  // Re-estampar el ac_hash local: si no, `dai check` marca atrasado por tu propia edición.
  if (opts.noResync) { info("--no-resync: el implements.yaml quedó con el ac_hash viejo (dai check te lo va a marcar)."); return md; }
  const target = discoverImplements(process.cwd()).find((f) => (f.implements || []).some((im) => im.id === id));
  if (!target) { info(`sin implements.yaml para ${id} en este repo — no hay ac_hash local que resincronizar.`); return md; }
  const prev = (target.implements.find((im) => im.id === id) || {}).ac_hash;
  if (prev === newHash && !newVer) { ok(`ac_hash local ya estaba al día (${newHash}).`); return md; }
  let txt = readFileSync(target.path, "utf8").replace(/^(\s*ac_hash:\s*).*$/m, `$1${newHash}`);
  if (newVer) txt = txt.replace(/^(\s*version:\s*).*$/m, `$1${newVer}`);
  writeFileSync(target.path, txt);
  ok(`ac_hash re-estampado: ${prev} → ${newHash}${newVer && newVer !== curVer ? ` (${newVer})` : ""} en ${rel(target.path)}`);
  if (prev !== newHash) warn("cambiaron los criterios: revisá que tu implementación los cubra, y corré tus tests.");
  return md;
}

// El .md de trabajo de una US: explícito con --us, o el `us.md` del change que la implementa.
function usFileFor(id, opts, { quiet = false } = {}) {
  if (typeof opts.us === "string") return opts.us;
  const target = discoverImplements(process.cwd()).find((f) => (f.implements || []).some((im) => im.id === id));
  const guess = target ? join(dirname(target.path), "us.md") : null;
  if (guess && existsSync(guess)) {
    if (!quiet) info(`sin --us: uso ${rel(guess)} (el change que implementa ${id}).`);
    return guess;
  }
  return null;
}

// ── edit-us: traer la US del tracker, editarla, validarla y guardarla ─────────
//
// Para el PO: la US vive en el tracker, no en un .md que alguien tiene que acordarse de
// sincronizar. Este comando la BAJA, te la abre en tu editor, valida el formato cuando
// guardás, te muestra qué cambia y recién ahí la sube. Si el formato no da, te deja
// volver al editor en vez de tirarte el trabajo.
async function cmdEditUs(id, opts = {}) {
  if (!id) fail("uso: dai edit-us <ID> [--us <archivo.md>] [--strict] [--dry-run] [--yes]", 1);
  if (!isValidKey(id)) fail(`key inválido: '${id}'. Sin espacios ni barras (ej.: ABC-482 o 86cxyz).`, 1);
  loadDaiEnv();
  const adapter = getAdapter(process.env);
  if (typeof adapter.updateUS !== "function") fail(`el backend '${adapter.kind}' no soporta actualizar US.`, 1);

  const live = await fetchLive(adapter, id);
  if (!live) {
    fail(`no encontré la US ${id} en ${adapter.kind}. ¿Es el key correcto?\n` +
         `  Para CREARLA:  dai publish <us.md>   (edit-us edita una que ya existe)`, 2);
  }

  // Dónde se edita: el us.md del change si existe (así el dev y el PO tocan el MISMO
  // archivo), si no `.dai/us/<ID>.md`, que es la convención del backend md.
  const file = usFileFor(id, opts, { quiet: true }) ||
    join(process.env.DAI_MD_US_DIR || join(".dai", "us"), `${id}.md`);

  // El cuerpo que baja del tracker. Si ya hay un .md local con el MISMO ac_hash, se
  // respeta el local: puede tener secciones del molde (contexto, fuera de scope) que el
  // tracker no devuelve, y pisarlas con la versión de arriba sería perder trabajo.
  let md = live.raw || null;
  const localExists = existsSync(file);
  const local = localExists ? readFileSync(file, "utf8") : null;
  if (local && acHash(local) === live.ac_hash) {
    md = local;
    info(`${rel(file)} ya está al día con ${adapter.kind} (ac_hash ${live.ac_hash}) — edito el local, que tiene el molde completo.`);
  } else if (md == null) {
    fail(`el backend '${adapter.kind}' no devuelve el cuerpo de la US, así que no puedo traerla para editar.\n` +
         "  Editá el .md a mano y empujalo con:  dai update-us " + id + " --us <archivo.md>", 1);
  } else if (localExists && typeof opts.us === "string") {
    // Pediste ESE archivo: es la fuente, punto. Bajarle la versión del tracker encima
    // borraría justo lo que viniste a subir — es el camino que usa /grill-user-story,
    // que escribe la US refinada al .md y después la empuja.
    md = local;
    info(`${rel(file)} es tu fuente (local ${acHash(local) || "sin criterios"} vs vivo ${live.ac_hash}) — no lo piso con el tracker.`);
  } else if (localExists) {
    warn(`${rel(file)} existe pero DIFIERE del tracker (local ${acHash(local) || "sin criterios"} vs vivo ${live.ac_hash}).`);
    // Ante la duda gana lo LOCAL: es trabajo que alguien escribió y que el tracker no
    // tiene. Pisarlo es la única de las dos opciones que destruye algo.
    if (!opts.yes && process.stdin.isTTY) {
      const ans = await askOrCancel("  ¿Lo piso con la versión del tracker? (s/N — 'n' edita el local tal cual) ");
      if (!/^s|^y/i.test(ans)) { md = local; info("Edito el local, sin pisarlo."); }
    } else {
      md = local;
      info(`edito el local sin pisarlo (${opts.yes ? "--yes" : "no interactivo"}). Para partir del tracker, borrá ${rel(file)} o pasá otro --us.`);
    }
  }

  mkdirSync(dirname(file), { recursive: true });
  if (md !== local) { writeFileSync(file, md); ok(`traje ${id} de ${adapter.kind} → ${rel(file)}`); }

  // ── El ciclo editar → validar ──────────────────────────────────────────────
  // Un formato inválido NO tira el trabajo: te devuelve al editor con los errores a la
  // vista. Se sale con Ctrl+C, no perdiendo lo escrito.
  for (;;) {
    if (!opts.noEditor) await openEditor(file);
    md = readFileSync(file, "utf8");
    const v = validateUS(md);
    if (v.ok || opts.noEditor || !process.stdin.isTTY) break;
    process.stdout.write(`\n  ── formato de la US (${rel(file)}) ────────────\n`);
    for (const l of renderValidation(v)) process.stdout.write(l + "\n");
    const ans = await askOrCancel("\n  El formato no da. ¿Vuelvo a abrir el editor? (S/n — 'n' aborta sin tocar el tracker) ");
    if (/^n/i.test(ans)) { info("Abortado — el tracker quedó como estaba; tu edición está en " + rel(file) + "."); return; }
  }

  await pushUS(id, md, { adapter, file, opts, live });
}

// Abre $VISUAL/$EDITOR sobre el archivo. Sin editor configurado no se impone `vi`: se
// pide editar el archivo y volver — funciona igual en una terminal, en un IDE, o con el
// archivo abierto en otra ventana.
async function openEditor(file) {
  const ed = process.env.VISUAL || process.env.EDITOR;
  if (ed && process.stdin.isTTY) {
    info(`abriendo ${rel(file)} en ${ed}…`);
    try {
      execFileSync(ed, [file], { stdio: "inherit", shell: process.platform === "win32" });
      return;
    } catch (e) {
      warn(`no pude abrir '${ed}': ${String(e.message).split("\n")[0]}`);
    }
  }
  if (!process.stdin.isTTY) return;
  if (!ed) info("no hay $EDITOR ni $VISUAL configurados.");
  await askOrCancel(`  Editá ${rel(file)} y presioná Enter cuando termines (Ctrl+C para abortar) `);
}

// ── update-us: empuja al tracker una US que ya escribiste ─────────────────────
//
// El inverso de `dai publish`: la US ya existe con su key, la refinaste implementando (un
// criterio que apareció escribiendo el test) y el tracker quedó viejo. Sin esto había que
// copiar y pegar a mano, que es justo lo que el método no quiere (Art. 10).
async function cmdUpdateUs(id, opts = {}) {
  if (!id) fail("uso: dai update-us <ID> [--us <archivo.md>] [--strict] [--no-resync] [--dry-run] [--yes]", 1);
  if (!isValidKey(id)) fail(`key inválido: '${id}'. Sin espacios ni barras (ej.: ABC-482 o 86cxyz).`, 1);
  loadDaiEnv();

  const file = usFileFor(id, opts);
  if (!file) {
    fail(`falta --us <archivo.md> con la US (no encontré un us.md junto al implements.yaml de ${id}).\n` +
         `  Si querés traerla del tracker y editarla ahí mismo:  dai edit-us ${id}`, 1);
  }
  if (!existsSync(file)) fail(`no existe el archivo '${file}'.`, 1);

  const adapter = getAdapter(process.env);
  if (typeof adapter.updateUS !== "function") fail(`el backend '${adapter.kind}' no soporta actualizar US.`, 1);
  const live = await fetchLive(adapter, id);
  if (!live && adapter.kind !== "md") {
    fail(`no encontré la US ${id} en ${adapter.kind}. ¿Es el key correcto? Para CREARLA: dai publish ${rel(file)}`, 2);
  }
  await pushUS(id, readFileSync(file, "utf8"), { adapter, file, opts, live });
}

// ── done: cierra una US — vuelve a la base, actualiza y borra la branch local ──
function cmdDone(opts) {
  loadDaiEnv();
  // Misma resolución que `dai pr`: el `main` fijo mandaba a checkout+pull a la rama
  // equivocada en cualquier repo que integre contra develop/testing (issue #46).
  if (opts.base === true) fail("--base necesita el nombre de una branch (ej: --base develop).", 1);
  const baseFlag = Array.isArray(opts.base) ? opts.base[opts.base.length - 1] : (typeof opts.base === "string" ? opts.base : null);
  const branch = gitBranch();
  const { base, source: baseSource } = resolveBase({ flag: baseFlag, branch, env: process.env, originHead: originHeadBranch() });
  if (!branch || branch === "HEAD") fail("no estás en una branch.", 1);
  if (branch === base) fail(`ya estás en '${base}' — nada que cerrar.`, 1);

  // Redes de seguridad: sin cambios sueltos, sin commits sin pushear.
  const dirty = (() => { try { return git(["status", "--porcelain"]).length > 0; } catch { return false; } })();
  if (dirty) fail("tienes cambios sin commitear. Haz commit o stashea antes de `dai done`.", 1);
  let remoteExists = false;
  try { git(["rev-parse", "--verify", `origin/${branch}`]); remoteExists = true; } catch { /* sin branch remota */ }
  if (remoteExists) {
    const ahead = Number(git(["rev-list", "--count", `origin/${branch}..${branch}`]) || "0");
    if (ahead > 0) fail(`tienes ${ahead} commit(s) sin pushear en '${branch}'. Pushea antes (o espera el merge).`, 1);
  }

  // La US que se cierra (informativo) — leerla ANTES de cambiar de branch.
  // Solo la de ESTA branch: antes listaba todas las del repo (archivadas incluidas), así
  // que cerrar una branch anunciaba el cierre de medio sprint — el mismo defecto que
  // `dai pr` en los issues #31/#32/#33, acá en un mensaje.
  const usIds = matchBranchToImplements(
    branch, flattenImplements(discoverImplements(process.cwd(), { includeArchived: false })),
  ).map((r) => r.id);

  // Ir a la base y actualizar.
  info(`Cambiando a '${base}' y actualizando… ${C.dim(`(base: ${baseSource})`)}`);
  try { git(["checkout", base]); } catch (e) { fail(`no pude cambiar a '${base}': ${String(e.message).split("\n")[0]}`, 1); }
  try { git(["fetch", "--prune"]); } catch { /* sin remoto */ }
  try { git(["pull", "--ff-only"]); } catch { warn(`no pude hacer 'pull --ff-only' en '${base}' (¿divergió?). Revisa a mano.`); }

  // Chequeo ESTRICTO de merge: la branch tiene que ser ancestro de la base actualizada.
  let merged = false;
  try { git(["merge-base", "--is-ancestor", branch, "HEAD"]); merged = true; } catch { merged = false; }
  if (!merged && !opts.force) {
    warn(`'${branch}' NO está mergeada en '${base}'. No la borro — usa 'dai done --force' si estás seguro.`);
    ok(`Quedaste en '${base}', actualizado. La branch '${branch}' se conserva.`);
    return;
  }
  try {
    git(["branch", merged ? "-d" : "-D", branch]);
    ok(`Borrada la branch local '${branch}'${merged ? "" : " (forzado, sin merge)"}.`);
  } catch (e) { fail(`no pude borrar '${branch}': ${String(e.message).split("\n")[0]}`, 1); }

  ok(`Listo — en '${base}', actualizado${usIds.length ? `. US cerrada: ${usIds.join(", ")}` : ""}.`);
  info("La branch remota (si existe) la maneja el forge (auto-delete on merge) o bórrala tú.");
}

// El comando del forge, listo para copiar y pegar. Cuando dai no llega, deja al dev
// parado exactamente donde estaba, no un paso atrás.
function shellHint(tool, cmd) {
  return `  Comando listo para correr a mano:\n    ${tool} ${cmd.map((c) => /\s/.test(c) ? `'${c}'` : c).join(" ")}\n`;
}

// La PR/MR abierta de esta branch, si la hay.
//   { number, url, title, base } → existe · null → no hay · undefined → no se pudo saber
// El `undefined` importa: sin binario, sin auth o con un glab viejo, dai no puede afirmar
// que NO existe, así que sigue por el camino de crear (que también sabe reconocerla).
function findExistingPr(tool, branch) {
  try {
    const out = execFileSync(tool, listPrCmd(tool, branch), { encoding: "utf8", cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
    return parsePrList(tool, out);
  } catch { return undefined; }
}

// ── pr: crea TU PROPIA PR/MR precargada desde el template + el link ────────────
// (Distinto de dai-review, que revisa la PR de OTRO. Tu PR la creas y revisas tú.)
async function cmdPr(opts) {
  loadDaiEnv();
  const remote = gitRemote(), branch = gitBranch(), commit = gitCommit();
  if (!remote) fail("no hay remoto git 'origin'. Configúralo para crear la PR.", 1);
  if (!branch || branch === "HEAD") fail("no estás en una branch.", 1);

  // 0. Estado del repo: primero avisar cambios sueltos; después elegir la base.
  const dirty = (() => { try { return git(["status", "--porcelain"]).length > 0; } catch { return false; } })();
  if (dirty) {
    warn("tienes cambios SIN commitear — NO van a entrar en la PR. Haz commit lo que falte antes de crearla.");
    if (!opts.yes && !process.stdin.isTTY) fail("working tree sucio (usa --yes para ignorarlo, pero haz commit primero).", 1);
  }

  // Un solo readline para todo el flujo interactivo (base + confirmación).
  let _rl = null;
  const ask = async (q) => {
    if (!process.stdin.isTTY) return null;   // no interactivo → sin preguntas
    if (!_rl) _rl = createInterface({ input: process.stdin, output: process.stdout });
    // Ctrl+D (EOF) → "" = cancelar, no un crash: todas estas preguntas preceden a una
    // acción hacia afuera (push + PR), y ahí abortar es la respuesta segura.
    try { return (await _rl.question(q)).trim(); }
    catch { process.stdout.write("\n"); return ""; }
  };
  const closeRl = () => { if (_rl) { _rl.close(); _rl = null; } };

  // Elegir la branch base. El default NO es `main` fijo: sale de la config del repo
  // (DAI_BRANCH_DEV / DAI_BRANCH_PROD) o de la rama default del remoto, y el preview lo dice.
  // Con `main` hardcodeado, en un repo donde main DESPLIEGA A PRODUCCIÓN la MR quedaba
  // proponiendo un merge a PRO y nada lo destacaba (issue #46).
  if (opts.base === true) { closeRl(); fail("--base necesita el nombre de una branch (ej: --base develop).", 1); }
  const baseFlag = Array.isArray(opts.base) ? opts.base[opts.base.length - 1] : (typeof opts.base === "string" ? opts.base : null);
  let { base, source: baseSource, reason: baseWhy } = resolveBase({ flag: baseFlag, branch, env: process.env, originHead: originHeadBranch() });
  if (!baseFlag) {
    const ans = await ask(`  ¿Contra qué branch va la PR? (${base}) `);
    if (ans) { base = ans; baseSource = "lo respondiste vos"; baseWhy = null; }
  }
  const toProd = isProdBranch(base, process.env);

  // La base puede no existir LOCAL (clones con --single-branch, repos donde el dev
  // trabaja sobre develop y la base es main, corporativos con la base solo en origin).
  // Antes el catch vacío se comía el error y seguía de largo: ni se contaban los commits
  // (→ "Cambios realizados" salía con el molde) ni frenaba el chequeo de abajo.
  const baseRev = resolveRev(base) || resolveRev(`origin/${base}`);
  if (!baseRev) warn(`no encuentro la branch base '${base}' (ni local ni en origin/${base}). Trae la base primero:  git fetch origin ${base}`);

  // Sin commits sobre la base no hay PR.
  let ahead = null;
  try { ahead = Number(git(["rev-list", "--count", `${baseRev}..HEAD`])); } catch { /* base ausente */ }
  if (ahead === 0) {
    fail(`no hay commits en '${branch}' por encima de '${base}'. Una PR necesita cambios: haz commit primero (git commit).`, 1);
  }

  // 1. Resolver el link (US) de ESTA branch (issues #31, #32, #33).
  //    Antes se recorrían todos los implements.yaml del repo —archivados incluidos— y
  //    ganaba el último: la branch, que es la que sabe la respuesta, no entraba en la
  //    decisión. La PR salía titulada con la historia de otro y nadie se enteraba,
  //    porque el `dai check ✅` del body era el de esa otra US.
  const rows = flattenImplements(discoverImplements(process.cwd(), { includeArchived: false }));
  const allRows = flattenImplements(discoverImplements(process.cwd()));
  const scope = prScope({ branch, rows, allRows, ids: opts.us ? [String(opts.us)] : [] });
  let entry = scope.target;

  if (scope.mode === "explicit" && !entry) {
    closeRl();
    fail(`no encontré implements.yaml para '${opts.us}'.\n` +
         `  US en este repo: ${allRows.map((r) => r.id).join(", ") || "(ninguna)"}`, 1);
  }
  if (scope.mode === "none") {
    closeRl();
    fail("no hay una US linkeada (implements.yaml). Si este PR implementa una US, corré `dai link-us` primero. Si es un chore/tooling (sin US), renombrá la branch a `chore/…` o creá la PR con tu forge: `glab mr create` / `gh pr create`.", 1);
  }
  if (scope.mode === "ambiguous") {
    // Elegir en silencio es EL bug: la PR sale publicada con el link QUÉ↔CÓMO de otra US.
    warn(`${scope.reason}.`);
    const listed = scope.candidates.map((r, i) => `    ${i + 1}) ${r.id}  ${C.dim(`(${r.change})`)}`).join("\n");
    process.stdout.write(`  US vivas en el repo:\n${listed}\n`);
    if (opts.yes || !process.stdin.isTTY) {
      closeRl();
      fail("no sé con qué US titular la PR. Decilo explícitamente:  dai pr --us <ID>", 1);
    }
    const ans = await ask(`  ¿Con qué US titulo la PR? (número, Enter=cancelar) `);
    if (!ans) { closeRl(); info("Cancelado — no se creó la PR."); return; }
    const n = Number(ans);
    if (!Number.isInteger(n) || n < 1 || n > scope.candidates.length) {
      closeRl();
      fail(`respuesta inválida: '${ans}'. Se esperaba un número entre 1 y ${scope.candidates.length}.`, 1);
    }
    entry = scope.candidates[n - 1];
  }

  // De dónde salió la US: en el preview, el título sin justificación no delata nada
  // cuando está mal (sugerencia del issue #32).
  const usWhy = entry ? (scope.mode === "ambiguous" ? "la elegiste vos" : scope.reason) : scope.reason;
  const { id, version, ac_hash } = entry || {};

  // 2. Estado de trazabilidad (dai check) contra la US viva.
  const adapter = getAdapter(process.env);
  // El `.catch(() => null)` que había acá convertía "el tracker no contestó" en "no hay US",
  // y esa afirmación se PUBLICABA en el cuerpo de la PR, al lado del id de la US que sí está.
  const { us: live, unreachable, reason } = await fetchLiveUS(adapter, id);
  if (unreachable) {
    warn(reason);
    warn("la PR va a decir que no se pudo verificar contra el tracker — no que no hay US.");
  }
  const status = id ? coverageStatus(ac_hash, live?.ac_hash, { unreachable }) : null;
  if (status === "atrasado") {
    warn(`la US ${id} está ATRASADA respecto de tu implementación (${ac_hash} ≠ ${live?.ac_hash}).`);
    warn(`resincroniza antes de abrir la PR:  dai link-us ${id} --resync`);
  }

  // 3. Componer el body desde el template.
  const tplPath = existsSync(join(process.cwd(), ".github", "pull_request_template.md"))
    ? join(process.cwd(), ".github", "pull_request_template.md")
    : join(ROOT, "templates", "pull-request.md");
  // Commits de la branch (para precargar "Cambios realizados").
  let commits = [];
  if (baseRev) {
    try { commits = git(["log", `${baseRev}..HEAD`, "--pretty=%s"]).split("\n").filter(Boolean); } catch { /* rango inválido */ }
  }
  // El texto que escribe quien crea la PR (el dev o su agente). Es la ÚNICA fuente de
  // una descripción de verdad: dai lee git y el tracker, no el porqué del cambio.
  const description = textOpt(opts, "description");
  const changes = textOpt(opts, "changes");
  // La canónica del tracker (live.url) gana sobre la derivada; el template gana sobre todo.
  const usUrl = id ? usUrlFor(id, live?.url) : null;
  if (id && !usUrl) {
    warn(`no sé la URL de ${id} en el tracker: la PR va a quedar sin link a la US.`);
    warn(`configurá DAI_TRACKER_URL_TEMPLATE en el .env.dai (p. ej. https://tu-tracker/browse/{id}).`);
  }
  const body = composePrBody(readFileSync(tplPath, "utf8"), {
    id, version, ac_hash, status, usUrl, usTitle: live?.title, commits, description, changes,
    noUsReason: id ? null : scope.reason,
    branch, branchUrl: branchUrl(remote, branch), commit, commitUrl: commitUrl(remote, commit),
  });
  // Sin US el título sale del último commit: describe lo que hay adentro, en vez de
  // pedirle prestada la historia a otro (issue #31).
  const title = prTitle(opts, id, live?.title, commits[0] || branch);
  const forge = detectForge(parseRemote(remote)?.host);
  const tool = forgeTool(forge);

  // ¿Ya hay una PR/MR abierta para esta branch? Si la hay, esto es una ACTUALIZACIÓN, y
  // hay que decirlo ANTES de confirmar: el bug del issue #46 era pushear (el diff quedaba
  // al día), fallar al crear, y dejar la MR con la descripción vieja sin avisar.
  //   null → no hay ninguna abierta · undefined → no se pudo saber (sin binario, sin auth)
  const existing = findExistingPr(tool, branch);

  // 4. Mostrar y pedir confirmación (acción hacia afuera).
  const accion = existing ? `a ACTUALIZAR (#${existing.number})` : "a crear";
  process.stdout.write(`\n  ── Pull Request ${accion} ──────────────────────────────\n`);
  process.stdout.write(`  título:   ${title}\n  de:       ${branch}\n`);
  process.stdout.write(`  a:        ${base}  ${C.dim(`(${baseSource}${baseWhy ? ` — ${baseWhy}` : ""})`)}${toProd ? `   ${C.b("⚠️  DESPLIEGA A PRODUCCIÓN")}` : ""}\n`);
  process.stdout.write(`  US:       ${id || C.dim("(sin US)")}  ${C.dim(`— ${usWhy}`)}\n`);
  process.stdout.write(`  forge:    ${forge} (${tool})${opts.assignee ? `\n  asignar:  ${opts.assignee}` : ""}${opts.draft ? "\n  draft:    sí" : ""}\n`);
  process.stdout.write(`  ─────────────────────────────────────────────────────\n\n${body}\n`);
  process.stdout.write(`  ─────────────────────────────────────────────────────\n`);
  const hint = baseHint(baseSource, base);
  if (hint) info(hint);
  if (existing) for (const l of describeUpdate(existing, { base, tool })) warn(l);

  // 4a. Gate de producción: proponer un merge a la rama que despliega a PRO no puede salir
  // de un default ni colarse con un `--yes` puesto por costumbre. Que lo diga alguien.
  if (toProd) {
    warn(`'${base}' está declarada como rama de PRODUCCIÓN (DAI_BRANCH_PROD).`);
    if (!opts.toProd) {
      if (opts.yes || !process.stdin.isTTY) {
        closeRl();
        fail(`no publico una PR contra producción sin que lo digas explícitamente.\n` +
             `  Si es a propósito:            dai pr --base ${base} --to-prod --yes\n` +
             `  Si era otra la base:          dai pr --base <rama-de-integracion>`, 1);
      }
      const a = await ask(`  Escribí '${base}' para confirmar que esta PR va a PRODUCCIÓN (Enter = cancelar): `);
      if (String(a ?? "").trim() !== base) { closeRl(); info("Cancelado — no se creó la PR."); return; }
    }
  }

  // 4b. Gate: una PR con el molde del template sin llenar no se puede revisar.
  // Pasaba en repos reales — "Descripción" con el comentario HTML (que no se renderiza:
  // la sección se ve VACÍA) y "Cambios realizados" con `Cambio 1/Cambio 2` — cada vez
  // que el tracker no respondía o la base no estaba local. dai NO inventa la descripción:
  // la pide. Sin TTY (el camino del agente) frena; en terminal avisa y decidís vos.
  const gaps = bodyGaps(body);
  if (gaps.length) {
    const how =
      `  Escribí el texto y pasáselo a dai:\n` +
      `    dai pr --description "Qué resuelve este cambio y por qué (2–4 líneas)."\n` +
      `    dai pr --description-file notas.md --changes-file cambios.md   (markdown multilínea)\n` +
      `  El detalle de "Cambios realizados" sale de los commits si no pasás --changes.\n`;
    if (opts.yes || !process.stdin.isTTY) {
      closeRl();
      fail(`la PR saldría con el molde del template sin llenar: ${gaps.join(", ")}.\n` +
           `  Una PR sin descripción no se puede revisar, así que no la publico.\n${how}`, 1);
    }
    warn(`la PR va a salir con el molde sin llenar: ${gaps.join(", ")}.`);
    process.stdout.write(how);
  }

  // Archivo de paso para gh/glab: en el temp del sistema, NO en el repo (no lo ensucia).
  const bodyFile = join(mkdtempSync(join(tmpdir(), "dai-pr-")), "body.md");
  if (!opts.yes) {
    if (!process.stdin.isTTY) { closeRl(); writeFileSync(bodyFile, body); info(`Body guardado en ${bodyFile}. Revisa y re-ejecuta con --yes para ${existing ? "actualizar" : "crear"}.`); return; }
    const a = (await ask(`  ¿Publico la branch y ${existing ? `actualizo la PR/MR #${existing.number}` : `creo el PR`} con ${tool}? (s/N) `) || "").toLowerCase();
    closeRl();
    if (!["s", "si", "sí", "y", "yes"].includes(a)) {
      writeFileSync(bodyFile, body);
      warn(`cancelado. Guardé el body en ${bodyFile} por si quieres editarlo o crearla a mano.`);
      return;
    }
  } else {
    closeRl();
  }

  // 5. Publicar la branch + crear el PR/MR.
  writeFileSync(bodyFile, body);
  try {
    info(`Publicando la branch ${branch}…`);
    // stdin heredado + GIT_TERMINAL_PROMPT=1: la PRIMERA vez contra un remoto HTTPS
    // corporativo, git/credential-manager necesita poder pedir la credencial. Con stdin
    // ignorado (el default de git()) el login no completaba y el push fallaba en seco.
    //
    // stderr heredado, y esto no es cosmético: git y ssh PREGUNTAN por stderr. Con
    // stderr en 'pipe' el prompt de una clave con passphrase ("Enter passphrase for
    // key …") caía en el pipe, invisible: el dev veía un cuelgue sin explicación, ssh
    // se rendía y terminaba cayendo a autenticación por password, y lo único que se
    // llegaba a leer era un "Permission denied (publickey…)" que acusa a la clave
    // cuando la clave estaba bien. Que pregunte a la vista.
    git(["push", "-u", "origin", branch], { stdio: ["inherit", "pipe", "inherit"], env: { ...process.env, GIT_TERMINAL_PROMPT: "1" } });
  } catch (e) {
    // git ya imprimió su error en vivo (stderr heredado); acá solo va la pista, y esa
    // pista depende del transporte: "pushea a mano una vez" arregla HTTPS y no arregla
    // nada en SSH, donde el push a mano falla igual (lib/git-ssh.mjs).
    const err = String(e.stderr || "").trim();
    if (err) process.stderr.write("  " + err.split("\n").join("\n  ") + "\n");
    for (const l of pushFailureHint(remote, branch)) process.stdout.write(`  ${l}\n`);
    fail(`no pude pushear la branch '${branch}'.`, 1);
  }

  // Actualizar la PR/MR que ya está abierta: mismo body, misma disciplina. La alternativa
  // —fallar y dejarla con la descripción vieja— es la que rompía el issue #46.
  const doUpdate = (number) => {
    const ucmd = updatePrCmd(tool, { number, title, body, bodyFile });
    try {
      info(`Actualizando la PR/MR #${number} con ${tool}…`);
      const out = execFileSync(tool, ucmd, { encoding: "utf8", cwd: process.cwd() });
      process.stdout.write(out);
      ok(`PR/MR #${number} actualizada: título + descripción${existing?.url ? ` — ${existing.url}` : ""}.`);
      try { rmSync(bodyFile); } catch { /* noop */ }
      return true;
    } catch (e) {
      const msg = String(e.stderr || e.message || "");
      // Plan B por REST: el comando de alto nivel puede fallar por algo ajeno a la edición
      // (gh consulta GraphQL y arrastra campos deprecados del servidor). Se intenta callado
      // y solo se reporta si TAMBIÉN falla — avisar de un error que se resolvió solo es ruido.
      const api = updatePrApiCmd(tool, { number, title, bodyFile, projectPath: parseRemote(remote)?.path });
      if (api) {
        try {
          execFileSync(tool, api, { encoding: "utf8", cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
          ok(`PR/MR #${number} actualizada: título + descripción${existing?.url ? ` — ${existing.url}` : ""}.`);
          info(`(\`${tool} pr edit\` falló por algo ajeno a la edición; se actualizó por la API REST)`);
          try { rmSync(bodyFile); } catch { /* noop */ }
          return true;
        } catch (e2) { process.stdout.write(`  ${tool} api también falló: ${String(e2.stderr || e2.message).split("\n")[0]}\n`); }
      }
      warn(`no pude actualizar la PR/MR #${number} con ${tool}. El body quedó en ${bodyFile}.`);
      if (msg.trim()) process.stdout.write(`  ${tool} dijo:\n  ${msg.trim().split("\n").join("\n  ")}\n`);
      process.stdout.write(shellHint(tool, ucmd));
      process.stdout.write(`  Si preferís no editarla: cerrá la PR/MR y volvé a correr \`dai pr\`.\n`);
      process.exitCode = 1;
      return false;
    }
  };
  if (existing) { doUpdate(existing.number); return; }

  const cmd = tool === "gh"
    ? ["pr", "create", "--title", title, "--body-file", bodyFile, "--base", base,
       ...(opts.assignee ? ["--assignee", opts.assignee] : []), ...(opts.draft ? ["--draft"] : [])]
    : ["mr", "create", "--title", title, "--description", body, "--target-branch", base, "--source-branch", branch,
       ...(opts.assignee ? ["--assignee", opts.assignee] : []), ...(opts.draft ? ["--draft"] : []), "--yes"];
  try {
    info(`Creando el PR/MR con ${tool}…`);
    const out = execFileSync(tool, cmd, { encoding: "utf8", cwd: process.cwd() });
    process.stdout.write(out);
    ok("PR/MR creada. Revísala tú y asigna el reviewer si falta.");
    try { rmSync(bodyFile); } catch { /* noop */ }
  } catch (e) {
    const msg = String(e.stderr || e.message || "");
    const manual = shellHint(tool, cmd);
    if (isAlreadyExistsError(msg) || isAlreadyExistsError(String(e.stdout || ""))) {
      // La detección de arriba no la vio (glab viejo, `--output json` no soportado, sin
      // permiso de lectura). El forge sí sabe que existe: se busca de nuevo y se actualiza.
      warn("el forge dice que YA hay una PR/MR abierta para esta branch, así que no se creó otra.");
      const found = findExistingPr(tool, branch);
      if (found) { doUpdate(found.number); return; }
      warn(`tampoco pude averiguar su número con ${tool}, así que NO toqué su descripción: quedó la vieja.`);
      process.stdout.write(`  Abrila y pegá el body de ${bodyFile}, o cerrala y volvé a correr \`dai pr\`.\n`);
      process.exitCode = 1;
      return;
    }
    if (e.code === "ENOENT") {
      // El binario del forge no está instalado (el caso más común detrás de "no salió la MR").
      const doc = tool === "glab" ? "https://gitlab.com/gitlab-org/cli/-/releases" : "https://cli.github.com";
      warn(`'${tool}' no está instalado. El body quedó en ${bodyFile}.`);
      process.stdout.write(`  Instalá ${tool} (${doc}) y autenticá con \`${tool} auth login\`${tool === "glab" ? " --hostname " + (parseRemote(remote)?.host || "tu-gitlab") : ""}, o creá la PR a mano.\n${manual}`);
    } else if (/no history in common|no commits between|not found.*base|base.*not found/i.test(msg)) {
      warn(`la branch no comparte historia con '${base}' en el remoto (o '${base}' no existe allá).`);
      process.stdout.write(`  Suele pasar cuando el repo local y el remoto son distintos. Empuja la base primero:\n    git push origin ${base}\n  y vuelve a correr:  dai pr\n`);
    } else {
      warn(`no pude crear la PR con ${tool}. El body quedó en ${bodyFile}.`);
      // El stderr real de gh/glab (auth vencida, host no configurado, flag desconocido…).
      if (msg.trim()) process.stdout.write(`  ${tool} dijo:\n  ${msg.trim().split("\n").join("\n  ")}\n`);
      process.stdout.write(manual);
    }
  }
}

// ── release plan: el manifiesto de la versión ─────────────────────────────────
//
// Contesta la pregunta que a un equipo sin versiones no le contesta nadie: qué User
// Stories tiene esta release. El tag, el CHANGELOG, el comentario en cada ticket y el
// aviso al canal son formas distintas de publicar ESTE dato, así que primero el dato.

// El último tag alcanzable, ordenado por semver (no por fecha: un hotfix tagueado tarde
// no es "el último release"). null si el repo todavía no tiene ninguno.
function lastTag() {
  try {
    const out = git(["tag", "--sort=-v:refname", "--merged", "HEAD"]);
    return out.split("\n").map((t) => t.trim()).filter(Boolean)[0] || null;
  } catch { return null; }
}

// Las US que entraron en el rango, leyendo los implements.yaml TAL COMO ESTABAN en cada
// commit que los tocó. El link viaja con el código, así que esto no depende de que la
// branch siga existiendo ni de que el change no se haya archivado — que es exactamente
// lo que pasa cuando llegás a cortar la release, días después del merge.
function linkedInRange(range) {
  const rows = [];
  let raw;
  try {
    raw = git(["log", "--format=\x1e%H", "--name-only", "--diff-filter=AMR", range, "--", "*implements.yaml"]);
  } catch { return rows; }
  let order = 0;
  for (const bloque of raw.split("\x1e")) {
    const lineas = bloque.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) continue;
    const sha = lineas[0];
    for (const path of lineas.slice(1)) {
      if (!path.endsWith("implements.yaml")) continue;
      let texto;
      try { texto = git(["show", `${sha}:${path}`]); } catch { continue; }   // borrado después
      let parsed;
      try { parsed = parseImplements(texto); } catch { continue; }
      for (const im of parsed.implements || []) {
        if (isPlaceholderId(im.id)) continue;
        rows.push({ ...im, change: parsed.change, repo: parsed.repo, path, sha, order: order++ });
      }
    }
  }
  return rows;
}

// El manifiesto, sin render: lo comparten plan, cut y done. Un solo lugar que sabe
// contestar "qué entra en esta versión" — si cada comando lo calculara a su manera,
// tarde o temprano dirían cosas distintas y le creerías al que tenés más a mano.
async function releaseManifest(opts = {}, { from, to } = {}) {
  const desde = from ?? (textOpt(opts, "from") || lastTag());
  const hasta = to ?? (textOpt(opts, "to") || branchFlow(process.env).dev || gitBranch());
  const toRev = resolveRev(hasta) || resolveRev(`origin/${hasta}`);
  if (!toRev) fail(`no encuentro '${hasta}' (ni local ni en origin/${hasta}).\n  Traelo primero:  git fetch origin ${hasta}`, 1);
  const range = desde ? `${desde}..${toRev}` : toRev;

  let commits = [];
  try { commits = parseCommitLog(git(["log", "--format=%H\x1f%s", range])); }
  catch (e) { fail(`no pude leer el historial de '${range}': ${String(e.message).split("\n")[0]}`, 1); }

  const linked = linkedInRange(range);
  const live = {};
  let unreachable = false;
  if (!opts.noNetwork && linked.length) {
    try {
      const adapter = getAdapter(process.env);
      for (const id of new Set(linked.map((r) => r.id))) {
        const { us, unreachable: nore } = await fetchLiveUS(adapter, id);
        if (nore) { unreachable = true; break; }
        if (us) live[id] = us;
      }
    } catch (e) { unreachable = true; warn(`no puedo verificar contra el tracker: ${String(e.message).split("\n")[0]}`); }
  }
  // ¿Este repo trabaja con User Stories? Si nunca declaró ninguna (archivadas incluidas),
  // marcar cada branch como "entró sin link" es ruido: en un repo de tooling ninguna va a
  // declararla nunca. Se mira el repo entero, no el rango.
  const repoUsesStories = flattenImplements(discoverImplements(process.cwd())).length > 0;
  const m = buildManifest({ commits, linked, live, unreachable: unreachable || Boolean(opts.noNetwork), repoUsesStories });
  return { manifest: m, commits, from: desde, to: hasta, range };
}

// La versión que este repo declara hoy. `null` si no espeja el número en ningún archivo
// que dai reconozca — que es legítimo: el tag es la fuente de verdad.
function currentVersion() {
  for (const [file, leer] of [
    ["VERSION", (t) => t.trim().split("\n")[0]],
    ["package.json", (t) => { try { return JSON.parse(t).version || null; } catch { return null; } }],
  ]) {
    const p = join(process.cwd(), file);
    if (existsSync(p)) { const v = leer(readFileSync(p, "utf8")); if (v) return { version: v, file }; }
  }
  return { version: null, file: null };
}

async function cmdReleasePlan(opts = {}) {
  loadDaiEnv();
  if (!gitBranch()) fail("esto no parece un repo git.", 1);
  const { manifest: m, commits, from, to } = await releaseManifest(opts);
  const { version: current } = currentVersion();
  const { bump, reason } = proposeBump(commits);
  const proposed = current ? nextVersion(current, bump) : null;

  if (opts.json) {
    process.stdout.write(JSON.stringify({ from, to, current, proposed, bump, reason, caveat: BUMP_CAVEAT, ...m }, null, 2) + "\n");
    return;
  }
  process.stdout.write("\n" + renderManifest(m, { from, to, current: current || "(sin archivo de versión)", proposed, bump, reason }) + "\n");
  process.stdout.write(`  ${C.dim(BUMP_CAVEAT.split("\n").join("\n  "))}\n\n`);
  if (m.counts.commits === 0) { info("no hay nada nuevo para promover: no hace falta cortar una versión."); return; }
  info(`Cuando lo confirmes:  dai release cut ${proposed || "<X.Y.Z>"}`);
}

// ── release cut: preparar la versión ─────────────────────────────────────────
// Branch + bump + entrada del CHANGELOG + commit. Todo lo que pasa ANTES de la firma
// humana; nada que hable hacia afuera (ni push, ni tag, ni PR).
async function cmdReleaseCut(versionArg, opts = {}) {
  loadDaiEnv();
  const branch = gitBranch();
  if (!branch) fail("esto no parece un repo git.", 1);
  let version;
  try { version = normalizeVersion(versionArg); }
  catch (e) { fail(`${e.message}\n  Uso:  dai release cut 1.2.0`, 1); }

  const dirty = (() => { try { return git(["status", "--porcelain"]).length > 0; } catch { return false; } })();
  if (dirty && !opts.dryRun) fail("tenés cambios sin commitear. Una versión se corta sobre un árbol limpio.", 1);

  const { manifest: m, commits, from, to } = await releaseManifest(opts);
  const { version: current, file: versionFile } = currentVersion();
  const { bump, reason } = proposeBump(commits);
  const sugerida = current ? nextVersion(current, bump) : null;

  // Qué archivos espejan el número en ESTE repo. Puede no haber ninguno (un repo .NET, un
  // frontend corporativo): el tag sigue siendo la versión.
  const espejos = [];
  for (const [file, fn] of [["VERSION", bumpVersionFile], ["package.json", bumpPackageJson]]) {
    const p = join(process.cwd(), file);
    if (!existsSync(p)) continue;
    const r = fn(readFileSync(p, "utf8"), version);
    espejos.push({ file, path: p, ...r });
  }

  const crearBranch = opts.branch !== false && !opts.noBranch;
  const nombreBranch = releaseBranch(version);

  process.stdout.write("\n" + renderManifest(m, { from, to, current: current || "(sin archivo)", proposed: version, bump: `pediste ${version}`, reason }) + "\n");
  process.stdout.write(`\n  ── Se va a preparar ─────────────────────────────────\n`);
  process.stdout.write(`  versión:  ${version}${sugerida && sugerida !== version ? C.dim(`   (dai habría propuesto ${sugerida} — ${bump})`) : ""}\n`);
  process.stdout.write(`  branch:   ${crearBranch ? `${nombreBranch}  (desde ${branch})` : C.dim("ninguna — se taguea desde la rama de integración")}\n`);
  for (const e of espejos) process.stdout.write(`  ${e.file.padEnd(9)} ${e.changed ? `${e.from} → ${version}` : C.dim(`ya está en ${version}`)}\n`);
  if (espejos.length === 0) process.stdout.write(`  ${C.dim("este repo no espeja el número en ningún archivo que dai reconozca: la versión es el tag")}\n`);
  process.stdout.write(`  CHANGELOG entrada nueva para ${version} (con el manifiesto para repartir)\n`);
  process.stdout.write(`  commit:   chore(release): v${version}\n`);
  process.stdout.write(`  ─────────────────────────────────────────────────────\n`);
  if (m.counts.atrasadas > 0) warn(`vas a cortar una versión con ${m.counts.atrasadas} US ATRASADA(S). Revisalas o resincronizá antes.`);
  if (m.orphans.length) warn(`hay ${m.orphans.length} branch(es) sin US ni prefijo exento en el rango.`);

  if (opts.dryRun) { info("[dry-run] no se tocó nada."); return; }
  if (!opts.yes) {
    if (!process.stdin.isTTY) { info("Sin TTY y sin --yes: no preparo la versión. Revisá el plan y re-ejecutá con --yes."); return; }
    const a = (await askOrCancel(`  ¿Preparo la versión ${version}? (s/N) `) || "").toLowerCase();
    if (!["s", "si", "sí", "y", "yes"].includes(a)) { info("Cancelado — no se tocó nada."); return; }
  }

  if (crearBranch) {
    try { git(["checkout", "-b", nombreBranch]); ok(`branch ${nombreBranch}`); }
    catch (e) { fail(`no pude crear '${nombreBranch}': ${String(e.message).split("\n")[0]}`, 1); }
  }
  const tocados = [];
  for (const e of espejos) {
    if (!e.changed) continue;
    writeFileSync(e.path, e.text);
    tocados.push(e.file);
    ok(`${e.file}: ${e.from} → ${version}`);
  }

  // CHANGELOG: el andamio y el material. La prosa la escribe una persona (o la skill).
  const chPath = join(process.cwd(), "CHANGELOG.md");
  const entry = changelogEntry({ version, date: new Date().toISOString().slice(0, 10), manifest: m });
  const previo = existsSync(chPath) ? readFileSync(chPath, "utf8") : "# Changelog\n";
  const repoUrl = (() => { const p = parseRemote(gitRemote()); return p ? `https://${p.host}/${p.path}` : null; })();
  const res = insertChangelogEntry(previo, entry, { version, repoUrl });
  if (res.changed) { writeFileSync(chPath, res.text); tocados.push("CHANGELOG.md"); ok(`CHANGELOG.md: entrada para ${version}`); }
  else warn(`CHANGELOG.md sin tocar — ${res.reason}.`);

  if (tocados.length === 0) { warn("no hubo nada que cambiar: no hago un commit vacío."); return; }
  git(["add", ...tocados]);
  git(["commit", "-m", `chore(release): v${version}`, "-m", `Manifiesto: ${m.counts.stories} US · ${m.counts.commits} commits desde ${from || "el principio"}.`]);
  ok(`commit chore(release): v${version}`);

  process.stdout.write("\n");
  info("Falta lo que dai no puede escribir por vos: repartí el manifiesto del CHANGELOG y contá el porqué.");
  info(`Después:  dai pr${crearBranch ? "" : ""}   →   se mergea   →   dai release done ${version}`);
}

// ── release done: cerrar la versión ────────────────────────────────────────
// DESPUÉS del merge. Tag + release note + back-merge + aviso. Es la mitad que se olvida
// cuando la ceremonia se hace a mano, y la que habla hacia afuera: cada paso se reporta
// por separado, porque si el release note falla el tag YA existe y hay que decirlo.
async function cmdReleaseDone(versionArg, opts = {}) {
  loadDaiEnv();
  let version;
  try { version = normalizeVersion(versionArg); }
  catch (e) { fail(`${e.message}\n  Uso:  dai release done 1.2.0`, 1); }
  const tag = tagName(version);
  const flow = branchFlow(process.env);
  const prod = textOpt(opts, "base") || flow.prod || parseOriginHead(safeGit(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"])) || "main";
  const dev = flow.dev;

  if (safeGit(["tag", "-l", tag])?.trim() === tag && !opts.force) {
    fail(`el tag ${tag} ya existe. Una versión no se re-taguea: si querés rehacerla, borrá el tag a mano (local y remoto) sabiendo lo que eso implica.`, 1);
  }
  try { git(["checkout", prod]); } catch (e) { fail(`no pude cambiar a '${prod}': ${String(e.message).split("\n")[0]}`, 1); }
  try { git(["pull", "--ff-only"]); } catch { warn(`no pude actualizar '${prod}' con pull --ff-only. Revisá a mano antes de taguear.`); }

  const head = gitCommit();
  const { version: enArchivo } = currentVersion();
  if (enArchivo && enArchivo !== version) {
    fail(`'${prod}' declara la versión ${enArchivo}, no ${version}.\n  ¿Se mergeó la PR de release? El tag tiene que apuntar al commit final.`, 1);
  }

  const { manifest: m } = await releaseManifest(opts, { to: prod });
  const notes = existsSync(join(process.cwd(), "CHANGELOG.md"))
    ? changelogSection(readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8"), version) : null;
  const cfg = (() => { try { return notifyConfig(process.env); } catch (e) { warn(String(e.message)); return null; } })();
  const avisar = cfg && !opts.noNotify;

  process.stdout.write(`\n  ── Cerrar la versión ${version} ──────────────────────────\n`);
  process.stdout.write(`  tag:      ${tag} → ${prod} @ ${String(head).slice(0, 8)}\n`);
  process.stdout.write(`  release:  ${opts.noRelease ? C.dim("no (--no-release)") : `nota en el forge${notes ? "" : C.dim(" (sin sección del CHANGELOG: sale con las notas del forge)")}`}\n`);
  process.stdout.write(`  back-merge: ${dev ? `${prod} → ${dev}` : C.dim("no (DAI_BRANCH_DEV no declarada)")}\n`);
  const relBranch = releaseBranch(version);
  const hayLocal = Boolean(safeGit(["rev-parse", "--verify", "--quiet", relBranch]));
  // Se pregunta al REMOTO, no a `origin/<branch>`: esa ref local queda desactualizada
  // cuando el forge borra la rama al mergear (auto-delete on merge, que es lo normal), y
  // dai terminaba intentando borrar algo que ya no estaba y reportando un ⚠ por un estado
  // que en realidad era el correcto. Avisar de un problema inexistente enseña a ignorar los avisos.
  const hayRemota = Boolean(safeGit(["ls-remote", "--heads", "origin", relBranch])?.trim());
  const limpiar = (hayLocal || hayRemota) && !opts.keepBranch;
  process.stdout.write(`  limpieza: ${limpiar
    ? `borrar ${relBranch}${hayLocal ? " (local)" : ""}${hayLocal && hayRemota ? " +" : ""}${hayRemota ? " (remota)" : ""}`
    : C.dim(hayLocal || hayRemota ? "no (--keep-branch)" : "nada que borrar")}\n`);
  process.stdout.write(`  aviso:    ${avisar ? describeTarget(cfg) : C.dim(cfg ? "no (--no-notify)" : "no (DAI_NOTIFY no declarado)")}\n`);
  process.stdout.write(`  ─────────────────────────────────────────────────────\n`);
  if (opts.dryRun) { info("[dry-run] no se tocó nada."); return; }
  if (!opts.yes) {
    if (!process.stdin.isTTY) { info("Sin TTY y sin --yes: no cierro la versión."); return; }
    const a = (await askOrCancel(`  ¿Cierro la versión ${version}? (s/N) `) || "").toLowerCase();
    if (!["s", "si", "sí", "y", "yes"].includes(a)) { info("Cancelado — no se tocó nada."); return; }
  }

  // 1. El tag. Es LA versión: si esto falla, no sigue nada.
  try {
    git(["tag", "-a", tag, "-m", `${tag}`, ...(opts.force ? ["-f"] : [])]);
    git(["push", "origin", tag, ...(opts.force ? ["--force"] : [])], { stdio: ["inherit", "pipe", "inherit"], env: { ...process.env, GIT_TERMINAL_PROMPT: "1" } });
    ok(`tag ${tag} creado y publicado`);
  } catch (e) { fail(`no pude crear o publicar el tag ${tag}: ${String(e.message).split("\n")[0]}`, 1); }

  // 2. Release note en el forge. De acá en adelante, cada paso reporta y sigue: el tag ya
  //    existe, y abortar dejaría la versión a medio cerrar sin decir en qué mitad quedó.
  let releaseUrl = null;
  if (!opts.noRelease) {
    const forge = detectForge(parseRemote(gitRemote())?.host);
    const tool = forgeTool(forge);
    const notesFile = join(mkdtempSync(join(tmpdir(), "dai-rel-")), "notes.md");
    if (notes) writeFileSync(notesFile, notes + "\n");
    const cmd = tool === "gh"
      ? ["release", "create", tag, "--target", prod, "--title", `${tag}`, ...(notes ? ["--notes-file", notesFile] : ["--generate-notes"]), "--latest"]
      : ["release", "create", tag, "--name", `${tag}`, ...(notes ? ["--notes-file", notesFile] : [])];
    try {
      const out = execFileSync(tool, cmd, { encoding: "utf8", cwd: process.cwd() });
      releaseUrl = (String(out).match(/https?:\/\/\S+/) || [null])[0];
      process.stdout.write(out);
      ok(`release note publicada${releaseUrl ? ` — ${releaseUrl}` : ""}`);
    } catch (e) {
      warn(`no pude publicar la release note con ${tool}: ${String(e.stderr || e.message).split("\n")[0]}`);
      process.stdout.write(shellHint(tool, cmd));
      process.stdout.write(`  El tag ${tag} SÍ está publicado: la versión existe, le falta la nota.\n`);
    }
  }

  // 3. Back-merge: el otro paso que se olvida. Sin esto, integración queda una versión atrás.
  if (dev) {
    try {
      git(["checkout", dev]); git(["pull", "--ff-only"]);
      git(["merge", "--no-edit", prod]);
      git(["push", "origin", dev], { stdio: ["inherit", "pipe", "inherit"], env: { ...process.env, GIT_TERMINAL_PROMPT: "1" } });
      ok(`back-merge ${prod} → ${dev}`);
    } catch (e) {
      warn(`no pude hacer el back-merge ${prod} → ${dev}: ${String(e.message).split("\n")[0]}`);
      process.stdout.write(`  Hacelo a mano:  git checkout ${dev} && git merge ${prod} && git push origin ${dev}\n`);
      process.stdout.write(`  Si no, '${dev}' queda una versión atrás y el próximo corte arranca torcido.\n`);
    }
  }

  // 4. Borrar la rama de release. Es el ÚNICO punto del ciclo donde dai puede afirmar que
  // es seguro: ya está mergeada en producción, tagueada y con el back-merge hecho. Si esto
  // no pasa acá, se acumulan — y una rama de release que sobrevive a su release es un fork.
  // Misma disciplina que `dai done`: `git branch -d` (minúscula) se niega si no está
  // mergeada, así que la red de seguridad la pone git, no una suposición nuestra.
  if (limpiar) {
    if (hayLocal) {
      try { git(["branch", "-d", relBranch]); ok(`borrada la branch local ${relBranch}`); }
      catch (e) {
        warn(`no borré '${relBranch}' local: ${String(e.message).split("\n")[0]}`);
        process.stdout.write(`  git se niega a borrar una branch sin mergear. Revisala: quizá tiene commits que no llegaron a '${prod}'.\n`);
      }
    }
    if (hayRemota) {
      try {
        git(["push", "origin", "--delete", relBranch], { stdio: ["inherit", "pipe", "inherit"], env: { ...process.env, GIT_TERMINAL_PROMPT: "1" } });
        ok(`borrada la branch remota origin/${relBranch}`);
      } catch (e) {
        warn(`no borré 'origin/${relBranch}': ${String(e.message).split("\n")[0]}`);
        process.stdout.write(`  Borrala a mano:  git push origin --delete ${relBranch}\n`);
      }
    } else if (hayLocal) {
      // La ref local puede seguir apuntando a una rama que el forge ya borró. Se limpia
      // para que el próximo `git branch -r` no muestre un fantasma.
      if (safeGit(["rev-parse", "--verify", "--quiet", `origin/${relBranch}`])) {
        safeGit(["branch", "-dr", `origin/${relBranch}`]);
        info(`la branch remota ya no estaba (la borró el forge al mergear); limpié la referencia local`);
      }
    }
  }

  // 5. El aviso. Lo último a propósito: anunciar algo que después falla es peor que no anunciar.
  if (avisar) {
    const ev = {
      event: "released", app: releaseApp(opts), version, environment: null,
      author: gitUser(), date: formatFecha(), url: releaseUrl,
      stories: m.stories.map((s) => ({ id: s.id, title: s.title })),
    };
    await confirmarYAvisar(cfg, ev, opts);
  }
  process.stdout.write("\n");
  ok(`versión ${version} cerrada.`);
  info(`Cuando la despliegues:  dai release stamp ${version} --env <ambiente>   (opcional: la release ya está hecha)`);
}

// ── release stamp: avisarle a cada US en qué versión y ambiente salió ────────
//
// Es el comando que más cuidado necesita del lote: escribe N veces hacia afuera, en
// tickets de gente distinta, y no se deshace. Por eso muestra el ALCANCE REAL antes de
// escribir —cuántos comentarios, en qué tickets, cuáles se saltean— y pide confirmación.
//
// Y es OPCIONAL: decir que no acá no rompe nada. Para cuando esto corre, el tag existe y
// el release note existe; la versión ya está. Que alguien elija no hacer ruido en veinte
// tickets es una decisión legítima, no un error a corregir — así que sale con 0.
async function cmdReleaseStamp(versionArg, opts = {}) {
  loadDaiEnv();
  let version;
  try { version = normalizeVersion(versionArg); }
  catch (e) { fail(`${e.message}\n  Uso:  dai release stamp 1.2.0 --env prod`, 1); }
  const environment = textOpt(opts, "env");
  if (!environment) {
    fail("falta --env: a qué ambiente se desplegó esta versión (prod, pre, test, el nombre que uses).\n" +
         "  dai no tiene catálogo de ambientes: el que pases es el que se estampa.", 1);
  }
  const app = releaseApp(opts);
  const tag = tagName(version);

  // El manifiesto de ESA versión: lo que entró entre el tag anterior y este. Se pide por
  // tag, no por rama, porque estampar es contar qué se desplegó — y lo desplegado es el tag.
  const previo = safeGit(["describe", "--tags", "--abbrev=0", `${tag}^`])?.trim() || null;
  if (!safeGit(["rev-parse", "--verify", "--quiet", `${tag}^{commit}`])) {
    fail(`no existe el tag ${tag} en este repo.\n  Cerrá la versión primero:  dai release done ${version}\n  (o traé los tags:  git fetch --tags)`, 1);
  }
  const { manifest: m } = await releaseManifest(opts, { from: previo, to: tag });

  // ¿Cuáles ya están estampadas? Sin poder leer los comentarios dai NO afirma que no las
  // estampó: lo dice, y quien decide es la persona. Afirmar de más acá se paga en duplicados.
  const marker = releaseMarker({ app, version, environment });
  const adapter = getAdapter(process.env);
  const stamped = new Set();
  let unknown = false;
  if (typeof adapter.listComments === "function") {
    for (const s of m.stories) {
      try { if (alreadyStamped(await adapter.listComments(s.id), marker)) stamped.add(s.id); }
      catch { unknown = true; }
    }
  } else unknown = true;

  const plan = stampPlan({ stories: m.stories, stamped, unknown });
  process.stdout.write("\n" + renderStampPlan(plan, { app, version, environment, tracker: adapter.kind }) + "\n");
  warn(stampWarning(plan));
  if (plan.pendientes.length === 0) { info("Nada que hacer."); return; }

  if (opts.dryRun) { info("[dry-run] no se escribió nada."); return; }
  if (!opts.yes) {
    if (!process.stdin.isTTY) {
      info(`Sin TTY y sin --yes: no estampo. Re-ejecutá con --yes si querés los ${plan.pendientes.length} comentarios.`);
      return;
    }
    const a = (await askOrCancel(`  ¿Estampo ${plan.pendientes.length} comentario(s)? (s/N) `) || "").toLowerCase();
    if (!["s", "si", "sí", "y", "yes"].includes(a)) {
      info("No se estampó nada — la release está hecha igual.");
      info(SIN_ESTAMPAR);
      return;   // salida 0: decir que no es una respuesta válida, no un error
    }
  }

  const cuerpo = renderReleaseStamp({
    app, version, environment, date: formatFecha(), commit: safeGit(["rev-list", "-n", "1", tag])?.trim(),
    url: textOpt(opts, "url") || null,
  });
  let hechos = 0;
  const fallados = [];
  for (const s of plan.pendientes) {
    try { await adapter.comment(s.id, cuerpo); hechos++; ok(`${s.id} estampada`); }
    catch (e) { fallados.push(s.id); warn(`${s.id}: ${String(e.message).split("\n")[0]}`); }
  }
  if (fallados.length) {
    warn(`quedaron ${fallados.length} sin estampar: ${fallados.join(", ")}. Volvé a correr el comando — las ya hechas se saltean.`);
    process.exitCode = 1;
  } else ok(`${hechos} US estampada(s) con ${app} ${tag} → ${environment.toUpperCase()}.`);

  // El aviso al canal es del EVENTO de despliegue, no del estampado: sale aunque no se
  // haya estampado nada (para eso está `--only-notify`), y no sale si el repo no lo declaró.
  const cfg = (() => { try { return notifyConfig(process.env); } catch (e) { warn(String(e.message)); return null; } })();
  if (cfg && !opts.noNotify) {
    await confirmarYAvisar(cfg, {
      event: "deployed", app, version, environment, author: gitUser(), date: formatFecha(),
      url: textOpt(opts, "url") || null, stories: m.stories.map((x) => ({ id: x.id, title: x.title })),
    }, opts);
  }
}

// ── release status: ¿dónde estoy en el ciclo? ────────────────────────────────
// Todo local + el forge: rápido y sin tocar el tracker. Lo que NO contesta —qué versión
// hay en cada ambiente— vive en los stamps de las US, porque un despliegue es un evento
// y no un archivo del repo: cambia sin que cambie el código.
async function cmdReleaseStatus(opts = {}) {
  loadDaiEnv();
  if (!gitBranch()) fail("esto no parece un repo git.", 1);
  const flow = branchFlow(process.env);
  const { version: declarada, file } = currentVersion();
  const tag = lastTag();
  const dev = flow.dev || gitBranch();
  const prod = flow.prod;

  info(`versión declarada: ${declarada ? `${declarada}  ${C.dim(`(${file})`)}` : C.dim("ningún archivo la espeja — la versión es el tag")}`);
  info(`último tag: ${tag || C.dim("(ninguno)")}`);
  if (tag && declarada && tagName(declarada) !== tag) {
    warn(`el archivo dice ${declarada} y el último tag es ${tag}: hay una versión preparada sin cerrar, o un tag sin bump.`);
  }

  // ¿Hay algo sin promover? Es la pregunta que dispara el ciclo.
  const { manifest: m, commits } = await releaseManifest({ ...opts, noNetwork: true }, { from: tag, to: dev });
  if (m.counts.commits === 0) info(`'${dev}' no tiene nada nuevo sobre ${tag || "el principio"}: no hay versión que cortar.`);
  else {
    const { bump } = proposeBump(commits);
    warn(`'${dev}' tiene ${m.counts.commits} commit(s) sin promover · ${m.counts.stories} US · bump propuesto: ${bump}.`);
    process.stdout.write(`    Ver el detalle:  dai release plan\n`);
  }

  // Back-merge pendiente: producción adelante de integración es el olvido clásico.
  if (prod && flow.dev) {
    const pendiente = safeGit(["rev-list", "--count", `${flow.dev}..${prod}`])?.trim();
    if (pendiente && Number(pendiente) > 0) {
      warn(`'${prod}' está ${pendiente} commit(s) adelante de '${flow.dev}': falta el back-merge.`);
      process.stdout.write(`    git checkout ${flow.dev} && git merge ${prod} && git push origin ${flow.dev}\n`);
    }
  }

  // Branches de release abiertas (model B): una que sobrevive a su release es un fork.
  const abiertas = (safeGit(["branch", "--list", "release/*", "--format=%(refname:short)"]) || "")
    .split("\n").map((x) => x.trim()).filter(Boolean);
  if (abiertas.length) {
    warn(`${abiertas.length} branch(es) de release sin borrar: ${abiertas.join(", ")}`);
    process.stdout.write(`    Una rama de release que sobrevive a su release es un fork. Desde 0.15.0 las borra\n`);
    process.stdout.write(`    \`dai release done\`; las de antes se limpian a mano (git se niega si alguna no está mergeada):\n`);
    process.stdout.write(`      git branch -d ${abiertas.join(" ")}\n`);
  }

  const cfg = (() => { try { return notifyConfig(process.env); } catch { return null; } })();
  info(`aviso al canal: ${cfg ? `${describeTarget(cfg)}  ${C.dim("(no verificado: eso lo dice `dai release notify --test`)")}` : C.dim("sin declarar (DAI_NOTIFY)")}`);

  // Los últimos releases publicados, según el forge. Es lo más cerca de "qué hay afuera"
  // que dai puede saber sin preguntarle al tracker ni al pipeline.
  if (!opts.noNetwork) {
    const tool = forgeTool(detectForge(parseRemote(gitRemote())?.host));
    try {
      const out = execFileSync(tool, ["release", "list", ...(tool === "gh" ? ["--limit", "3"] : ["--per-page", "3"])],
        { encoding: "utf8", cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
      const lineas = String(out).split("\n").filter(Boolean).slice(0, 3);
      if (lineas.length) { info("últimos releases publicados:"); for (const l of lineas) process.stdout.write(`    ${l}\n`); }
    } catch { /* sin binario, sin auth o sin releases: no es un problema que resolver acá */ }
  }
}

// ── release notify --test: probar el canal sin esperar a una release ─────────
// Un webhook no se puede validar sin postear. Fingir que sí sería justo lo que dai no hace,
// así que esto POSTEA de verdad — y lo dice antes.
async function cmdReleaseNotify(opts = {}) {
  loadDaiEnv();
  let cfg;
  try { cfg = notifyConfig(process.env); } catch (e) { fail(String(e.message), 1); }
  if (!cfg) fail("no hay canal declarado: poné DAI_NOTIFY (y DAI_NOTIFY_WEBHOOK) en el .env.dai.", 1);
  if (!opts.test) fail("por ahora `dai release notify` solo sabe probar el canal:  dai release notify --test", 2);
  await confirmarYAvisar(cfg, { event: "test" }, opts);
}

// El nombre de la app en los avisos y en el stamp. Sale del repo, no de una variable
// nueva: `--app` lo pisa cuando el nombre lindo no es el del directorio.
function releaseApp(opts) {
  return textOpt(opts, "app") || gitRepoName() || basename(process.cwd()) || null;
}

// Mostrar el mensaje EXACTO que va a salir y pedir confirmación. Un mensaje a un canal de
// equipo no se desmanda: se muestra antes, siempre, aunque el aviso sea de una sola línea.
async function confirmarYAvisar(cfg, ev, opts = {}) {
  const msg = renderNotice(ev);
  process.stdout.write(`\n  ── Aviso a ${describeTarget(cfg)} ──\n`);
  process.stdout.write(msg.split("\n").map((l) => `  │ ${l}`).join("\n") + "\n");
  process.stdout.write(`  ──────────────────────────────────────\n`);
  if (opts.dryRun) { info("[dry-run] no se envió."); return; }
  if (!opts.yes) {
    if (!process.stdin.isTTY) { info("Sin TTY y sin --yes: no aviso al canal."); return; }
    const a = (await askOrCancel(`  ¿Aviso al canal? (s/N) `) || "").toLowerCase();
    if (!["s", "si", "sí", "y", "yes"].includes(a)) { info("No se avisó — la release está hecha igual."); return; }
  }
  const r = await sendNotice(cfg, ev);
  if (r.ok) ok(`avisado a ${describeTarget(cfg)}`);
  else { warn(r.error); process.stdout.write(`  El aviso no salió, pero la release SÍ está hecha.\n`); }
}

function safeGit(args) { try { return git(args); } catch { return null; } }

// ── install: skills → ~/.claude/skills o <repo>/.claude/skills ────────────────// ── install: skills → ~/.claude/skills o <repo>/.claude/skills ────────────────
async function cmdInstall(opts) {
  if (opts.from !== undefined) return cmdInstallFrom(opts);   // skills externas (ADR-0013)
  const skillsSrc = join(ROOT, "skills");
  const skills = readdirSync(skillsSrc).filter((n) => statSync(join(skillsSrc, n)).isDirectory());
  let want;
  try { want = parseAssistants(typeof opts.for === "string" ? opts.for : "all"); }
  catch (e) { fail(`--for ${e.message}`); }
  const wantClaude = want.claude, wantCursor = want.cursor, wantCopilot = want.copilot;
  if (!wantClaude && !wantCursor && !wantCopilot) fail("nada para instalar: pasá --for claude|copilot|cursor|all.");
  const installFor = [wantClaude && "claude", wantCopilot && "copilot", wantCursor && "cursor"].filter(Boolean).join("+");
  const interactive = process.stdin.isTTY && !opts.global && opts.local === undefined;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

  const scopeFor = async (name) => {
    if (opts.global) return { scope: "global" };
    if (opts.local !== undefined) return { scope: "local", repo: typeof opts.local === "string" ? opts.local : process.cwd() };
    const a = (await rl.question(`¿Dónde instalar '${name}'? [g]lobal · [l]ocal · [s]altar (g) `)).trim().toLowerCase();
    return a === "l" ? { scope: "local", repo: process.cwd() } : a === "s" ? { scope: "skip" } : { scope: "global" };
  };

  // Cada asistente tiene SU dir: Claude ~/.claude/skills · Copilot ~/.copilot/skills
  // (ADR-0014) · Cursor ~/.cursor/skills. Local, el de Copilot es .github/skills.
  const LOCAL_DIR = { claude: [".claude", "skills"], copilot: [".github", "skills"], cursor: [".cursor", "skills"] };
  const GLOBAL_DIR = { claude: CLAUDE_SKILLS_DIR, copilot: COPILOT_SKILLS_DIR, cursor: CURSOR_SKILLS_DIR };

  const installOne = async ({ name, scope, repo, kind }) => {
    const src = join(skillsSrc, name);
    const targetDir = scope === "local" ? join(repo, ...LOCAL_DIR[kind]) : GLOBAL_DIR[kind];
    const target = join(targetDir, name);
    const label = `${name} (${kind})`;

    let sameAsSource = false;
    if (existsSync(target)) {
      if (kind !== "cursor") {
        // claude y copilot son copia cruda del SKILL.md: comparación directa.
        sameAsSource = dirsEqual(src, target);
      } else {
        const tempRoot = mkdtempSync(join(tmpdir(), "dai-cursor-skill-"));
        const tempTarget = join(tempRoot, name);
        mkdirSync(tempRoot, { recursive: true });
        cpSync(src, tempTarget, { recursive: true });
        const srcMd = readFileSync(join(src, "SKILL.md"), "utf8");
        writeFileSync(join(tempTarget, "SKILL.md"), skillToCursor(srcMd));
        sameAsSource = dirsEqual(tempTarget, target);
        rmSync(tempRoot, { recursive: true, force: true });
      }

      if (sameAsSource) { ok(`${label} — ya instalada e idéntica, salto`); return; }
      if (!opts.force) {
        if (!interactive) { warn(`${label} existe y difiere — salto (usa --force)`); return; }
        const a = (await rl.question(`   ${label} existe y DIFIERE. ¿[p]isar · [s]altar? (s) `)).trim().toLowerCase();
        if (a !== "p") { warn(`salto ${label}`); return; }
      }
    }

    if (opts.dryRun) { info(`[dry-run] ${label} → ${targetDir}`); return; }
    rmSync(target, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    cpSync(src, target, { recursive: true });
    if (kind === "cursor") {
      const srcMd = readFileSync(join(src, "SKILL.md"), "utf8");
      writeFileSync(join(target, "SKILL.md"), skillToCursor(srcMd));
    }
    ok(`${label} → ${targetDir}`);
  };

  info(`Instalando skills de dai (${installFor})`);
  for (const name of skills) {
    const { scope, repo } = await scopeFor(name);
    if (scope === "skip") { warn(`salto ${name}`); continue; }
    if (wantClaude) await installOne({ name, scope, repo, kind: "claude" });
    if (wantCopilot) await installOne({ name, scope, repo, kind: "copilot" });
    if (wantCursor) await installOne({ name, scope, repo, kind: "cursor" });
  }
  if (rl) rl.close();
}

// ── skills install --from: skills EXTERNAS (por-stack) desde un repo/dir ───────
// Self-service, one-off, sin registro ni sync (ADR-0013). Convierte cada skill
// para los 3 asistentes y la instala en el repo. No pisa las skills built-in de
// dai (colisión → warn + skip). `dai sync` NO las toca: es solo de dai.
function cmdInstallFrom(opts) {
  if (typeof opts.from !== "string" || !opts.from.trim())
    fail("--from necesita una fuente: un git URL (github.com/org/skills[#ref]), un paquete npm (npm:@scope/pkg) o un path local", 2);
  let want;
  try { want = parseAssistants(typeof opts.for === "string" ? opts.for : "all"); }
  catch (e) { fail(`--for ${e.message}`); }

  let src;
  try { src = parseSource(opts.from); } catch (e) { fail(`--from ${e.message}`, 2); }

  // Resolver la fuente a un directorio local.
  let root, tmp = null;
  if (src.type === "git") {
    tmp = mkdtempSync(join(tmpdir(), "dai-skills-"));
    info(`clonando ${src.location}${src.ref ? " @ " + src.ref : ""} …`);
    const args = ["clone", "--depth", "1"];
    if (src.ref) args.push("--branch", src.ref);
    args.push(src.location, tmp);
    try { git(args); }
    catch (e) { rmSync(tmp, { recursive: true, force: true }); fail(`no pude clonar la fuente: ${String(e.message).split("\n")[0]}`, 1); }
    root = tmp;
  } else if (src.type === "npm") {
    tmp = mkdtempSync(join(tmpdir(), "dai-skills-"));
    info(`bajando el paquete npm ${src.location} …`);
    try {
      // `npm install` (no `npm pack`) en el temp. Dos decisiones a propósito:
      // 1) install en vez de pack: los registries de GRUPO de GitLab devuelven una
      //    `dist.tarball` malformada (el scope duplicado en el nombre) que `npm pack` sigue
      //    literal y da 404; `npm install` —como `npx`— reconstruye la URL y resuelve.
      // 2) copiamos el `.npmrc` del repo al temp y corremos con cwd=temp: así npm ve el
      //    registry/scope privado (con `--prefix` npm NO lee el `.npmrc` del cwd y se va al
      //    registry público). `--ignore-scripts`: no corremos scripts de un paquete de 3ros.
      const repoNpmrc = join(process.cwd(), ".npmrc");
      if (existsSync(repoNpmrc)) cpSync(repoNpmrc, join(tmp, ".npmrc"));
      runNpmTool("npm", ["install", src.location,
        "--no-save", "--no-package-lock", "--ignore-scripts", "--no-audit", "--no-fund"],
        { cwd: tmp, stdio: ["ignore", "ignore", "pipe"] });
      // El paquete queda en <tmp>/node_modules/<name>. name = spec sin la versión
      // (@scope/pkg@1.2.3 → @scope/pkg; el `@` inicial del scope no cuenta).
      let name = src.location; const at = name.lastIndexOf("@");
      if (at > 0) name = name.slice(0, at);
      root = join(tmp, "node_modules", name);
      if (!existsSync(root)) throw new Error(`npm install no dejó '${name}' en node_modules`);
    } catch (e) {
      rmSync(tmp, { recursive: true, force: true });
      const detail = String(e.stderr || e.stdout || e.message || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3).join("\n         ");
      fail(`no pude bajar el paquete npm '${src.location}':\n         ${detail || "npm install falló — revisá el spec, el registry y el .npmrc del repo"}`, 1);
    }
  } else {
    root = src.location;
    if (!existsSync(root)) fail(`no existe la fuente: ${root}`, 2);
  }

  const cleanup = () => { if (tmp) rmSync(tmp, { recursive: true, force: true }); };

  // El dir de skills: <root>/skills, o <root> si ya contiene <name>/SKILL.md.
  const skillsDir = existsSync(join(root, "skills")) ? join(root, "skills") : root;
  let entries;
  try {
    entries = readdirSync(skillsDir).filter((n) => {
      try { return statSync(join(skillsDir, n)).isDirectory(); } catch { return false; }
    });
  } catch { cleanup(); fail(`no pude leer la fuente: ${skillsDir}`, 2); }
  if (entries.length === 0) { cleanup(); fail("la fuente no tiene directorios de skill", 2); }

  // Destino: repo local (default cwd), o --local <repo> / --global.
  const repo = opts.global ? homedir() : (typeof opts.local === "string" ? opts.local : process.cwd());
  const builtins = new Set(readdirSync(join(ROOT, "skills")));
  const forStr = ["claude", "copilot", "cursor"].filter((a) => want[a]).join("+");
  info(`skills install --from ${opts.from}  ·  ${entries.length} candidata(s)  ·  asistentes: ${forStr}${opts.dryRun ? "  [dry-run]" : ""}`);

  let installed = 0, skipped = 0;
  for (const name of entries) {
    const srcDir = join(skillsDir, name);
    const skillPath = join(srcDir, "SKILL.md");
    // Validación estructural (contrato mínimo, no contenido — ADR-0013).
    if (!existsSync(skillPath)) { warn(`'${name}' no tiene SKILL.md — salto`); skipped++; continue; }
    if (builtins.has(name)) { warn(`'${name}' choca con una skill de dai — salto (renombrala, p.ej. ${name}-<stack>)`); skipped++; continue; }
    const md = readFileSync(skillPath, "utf8");
    const bad = validateSkill(md);
    if (bad) { warn(`'${name}' inválida: ${bad} — salto (ver templates/skill.md)`); skipped++; continue; }
    if (opts.dryRun) { info(`[dry-run] ${name} → ${forStr}`); continue; }
    if (want.claude) {
      const t = join(repo, ".claude", "skills", name);
      rmSync(t, { recursive: true, force: true }); mkdirSync(dirname(t), { recursive: true }); cpSync(srcDir, t, { recursive: true });
    }
    if (want.cursor) {
      const t = join(repo, ".cursor", "skills", name);
      rmSync(t, { recursive: true, force: true }); cpSync(srcDir, t, { recursive: true }); writeFileSync(join(t, "SKILL.md"), skillToCursor(md));
    }
    if (want.copilot) {
      // Copilot lee SKILL.md nativo (Agent Skills, ADR-0014): copia cruda, con templates/.
      const t = join(repo, ".github", "skills", name);
      rmSync(t, { recursive: true, force: true }); mkdirSync(dirname(t), { recursive: true }); cpSync(srcDir, t, { recursive: true });
    }
    ok(name); installed++;
  }
  cleanup();
  if (opts.dryRun) { info("dry-run: nada escrito."); return; }
  process.stdout.write("\n");
  if (installed === 0) {
    fail(`0 skills instaladas${skipped ? ` (${skipped} salteada(s))` : ""} — revisá el formato: cada skill es un dir con SKILL.md y frontmatter (name + description). Molde en templates/skill.md`, 1);
  }
  ok(`${installed} skill(s) externa(s) instalada(s)${skipped ? `, ${skipped} salteada(s)` : ""} desde ${opts.from}`);
  warn("skills externas — bajo tu criterio: dai las convierte e instala, no las vetea ni las trackea. `dai sync` no las toca.");
}

// ── helpers de prompt interactivo ─────────────────────────────────────────────
async function askMenu(rl, title, choices, def) {
  process.stdout.write(`\n  ${title}\n`);
  choices.forEach((c, i) => process.stdout.write(`    ${i + 1}) ${c.label}${c.value === def ? "   · por defecto" : ""}\n`));
  const a = (await rl.question("  → ")).trim().toLowerCase();
  if (!a) return def;
  const n = Number(a);
  if (Number.isInteger(n) && n >= 1 && n <= choices.length) return choices[n - 1].value;
  return choices.find((c) => c.value === a)?.value || def;
}
async function askYesNo(rl, q, def = false) {
  const a = (await rl.question(`  ${q} ${def ? "(S/n)" : "(s/N)"} `)).trim().toLowerCase();
  if (!a) return def;
  return ["s", "si", "sí", "y", "yes"].includes(a);
}

// ── init: scaffolder interactivo del repo ─────────────────────────────────────
async function cmdInit(repo, opts) {
  repo = repo || ".";   // por defecto, el directorio actual (como git init / npm init)
  if (!existsSync(repo)) {
    // Error común: `--for claude, cursor` con espacio → la shell parte y 'cursor' cae acá como repo.
    const hint = isAssistantToken(repo)
      ? `\n  ¿Separaste --for con un espacio? '${repo}' quedó como <repo>. Usá coma SIN espacio: --for claude,cursor`
      : "";
    fail(`no existe el directorio: ${repo}${hint}`);
  }
  const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;

  process.stdout.write(initBanner());

  // Preguntas primero (después cerramos readline para liberar stdin a los instaladores).
  let forOpt = typeof opts.for === "string" ? opts.for.toLowerCase() : null;
  if (!forOpt && rl) forOpt = await askMenu(rl, "¿Para qué asistente de IA preparo el repo? (genera las skills en su formato)", [
    { value: "all", label: "Todos (Claude + Copilot + Cursor) — por defecto" },
    { value: "both", label: "Claude + Copilot — equipo mixto (sin Cursor)" },
    { value: "claude", label: "Solo Claude (Code / Desktop)" },
    { value: "copilot", label: "Solo Copilot (en VS Code / JetBrains)" },
    { value: "cursor", label: "Solo Cursor (Agent)" },
  ], "all");
  forOpt = forOpt || "all";
  let want;
  try { want = parseAssistants(forOpt); } catch (e) { fail(`--for ${e.message}`); }

  let pm = typeof opts.pm === "string" ? opts.pm.toLowerCase() : null;
  if (!pm && rl) pm = await askMenu(rl, "¿Dónde van a vivir las User Stories?", [
    { value: "md", label: "Archivos .md locales — sin credenciales, ideal para probar" },
    { value: "clickup", label: "ClickUp — necesita un token" }, { value: "jira", label: "Jira — necesita un token" },
  ], "md");
  pm = pm || "md";
  if (!["md", "clickup", "jira"].includes(pm)) fail(`--pm inválido: '${pm}' (md|clickup|jira)`);

  // OpenSpec "presente" = init COMPLETA, no solo la carpeta (una openspec/ vacía o a
  // medias no cuenta — nos pasó al anidar el instalador). Buscamos su config.
  const openspecDir = join(repo, "openspec");
  const hasOpenspec = existsSync(join(openspecDir, "config.yaml")) ||
                      existsSync(join(openspecDir, "project.md"));
  const openspecPartial = existsSync(openspecDir) && !hasOpenspec;  // carpeta pero sin init
  let installOpenspec = opts.openspec === true;
  if (!hasOpenspec && opts.openspec === undefined && rl) {
    process.stdout.write("\n  OpenSpec es el motor recomendado del CÓMO: convierte la US en design + tasks\n");
    process.stdout.write(`  (${opsxHint(want)}). No está en este repo — la trazabilidad de dai anda igual sin\n`);
    process.stdout.write("  él, pero para el flujo completo conviene tenerlo.\n");
    installOpenspec = await askYesNo(rl, "¿Instalar el CLI de OpenSpec ahora? (después ejecutas `openspec init` tú)", false);
  }

  if (rl) rl.close();

  // ── Generación ───────────────────────────────────────────────────────────────
  const wantClaude = want.claude, wantCopilot = want.copilot, wantCursor = want.cursor;
  process.stdout.write("\n  Configurando…\n\n");

  const dai = join(repo, ".dai");
  for (const sub of ["templates", "governance"]) {
    const src = join(ROOT, sub);
    if (existsSync(src)) { mkdirSync(join(dai, sub), { recursive: true }); cpSync(src, join(dai, sub), { recursive: true }); }
  }
  writeFileSync(join(dai, "VERSION"), readFileSync(join(ROOT, "VERSION"), "utf8"));
  ok(".dai/         moldes (templates) + reglas (governance) del método");
  info("              gate de CI opcional: cp .dai/templates/ci-dai-gate.yml .github/workflows/");

  // Config de dai en SUS PROPIOS archivos, sin tocar el `.env`/`.env.example` del equipo:
  // muchas orgs versionan el `.env` como política, así que dai lo deja en paz (solo lo lee,
  // por compat) y pone lo suyo en `.env.dai` (ver ADR-0017). `.env.dai.example` se versiona
  // como plantilla; `.env.dai` (gitignored) es donde cada dev completa token y datos propios.
  const envBlock = envFor(pm);

  // .env.dai.example — plantilla VERSIONADA, mismas claves con valores VACÍOS (sin secretos).
  const exPath = join(repo, ".env.dai.example");
  if (existsSync(exPath)) {
    const cur = readFileSync(exPath, "utf8"), merged = mergeEnv(cur, envBlock);
    if (merged !== cur) { writeFileSync(exPath, merged); ok(".env.dai.example  claves de dai agregadas (aditivo)"); }
    else ok(".env.dai.example  ya tenía la config de dai");
  } else { writeFileSync(exPath, envBlock); ok(".env.dai.example  creado (plantilla versionada)"); }

  // .env.dai — el real de cada dev (gitignored): aditivo; si no existe, lo crea.
  const envPath = join(repo, ".env.dai");
  if (existsSync(envPath)) {
    const cur = readFileSync(envPath, "utf8"), merged = mergeEnv(cur, envBlock);
    if (merged !== cur) { writeFileSync(envPath, merged); ok(`.env.dai      claves de dai agregadas (aditivo, DAI_PM=${pm}${pm === "md" ? "" : " — completa el token"})`); }
    else ok(".env.dai      ya tenía la config de dai");
  } else { writeFileSync(envPath, envBlock); ok(`.env.dai      creado (no versionado), DAI_PM=${pm}${pm === "md" ? "" : " (completa el token)"}`); }

  // .gitignore — versiona los artefactos de dai (según --for), deja fuera solo lo personal.
  const giPath = join(repo, ".gitignore");
  const gi = reconcileGitignore(existsSync(giPath) ? readFileSync(giPath, "utf8") : "", want);
  if (gi.changed) { writeFileSync(giPath, gi.text.endsWith("\n") ? gi.text : gi.text + "\n"); ok(".gitignore    ajustado (skills/constitución versionadas; .env.dai y settings.local.json fuera)"); }

  mkdirSync(join(repo, ".github"), { recursive: true });
  cpSync(join(ROOT, "templates", "pull-request.md"), join(repo, ".github", "pull_request_template.md"));
  ok(".github/      pull_request_template.md — molde de PR atado al link");

  const skillsSrc = join(ROOT, "skills");
  const skills = readdirSync(skillsSrc).filter((n) => statSync(join(skillsSrc, n)).isDirectory());

  if (wantClaude) {
    const dir = join(repo, ".claude", "skills");
    mkdirSync(dir, { recursive: true });
    for (const name of skills) cpSync(join(skillsSrc, name), join(dir, name), { recursive: true });
    const cPath = join(repo, "CLAUDE.md"), cCur = existsSync(cPath) ? readFileSync(cPath, "utf8") : "";
    writeFileSync(cPath, upsertBlock(cCur, constitution("claude")));
    ok(`Claude:       .claude/skills/ (${skills.length}) + CLAUDE.md${cCur ? " (bloque dai, aditivo)" : ""} → conoce el método y las skills`);
  }
  if (wantCopilot) {
    // Copilot lee SKILL.md nativo (Agent Skills, ADR-0014): copia cruda, sin convertir.
    // Así viajan también los templates/ que la conversión a .prompt.md perdía.
    const dir = join(repo, ".github", "skills");
    mkdirSync(dir, { recursive: true });
    for (const name of skills) cpSync(join(skillsSrc, name), join(dir, name), { recursive: true });
    const ciPath = join(repo, ".github", "copilot-instructions.md"), ciCur = existsSync(ciPath) ? readFileSync(ciPath, "utf8") : "";
    writeFileSync(ciPath, upsertBlock(ciCur, constitution("copilot")));
    ok(`Copilot:      .github/skills/ (${skills.length}) + copilot-instructions.md${ciCur ? " (bloque dai, aditivo)" : ""}`);
    // Los .prompt.md de versiones previas duplicarían cada /comando con una copia
    // vieja y sin templates. Solo borramos los que generó dai, nunca los del equipo.
    const pdir = join(repo, ".github", "prompts");
    const stale = existsSync(pdir) ? stalePromptFiles(skills).filter((f) => existsSync(join(pdir, f))) : [];
    for (const f of stale) rmSync(join(pdir, f), { force: true });
    if (stale.length) info(`              quité ${stale.length} .prompt.md viejo(s) de .github/prompts/ — ahora son skills`);
  }
  if (wantCursor) {
    const dir = join(repo, ".cursor", "skills");
    mkdirSync(dir, { recursive: true });
    for (const name of skills) {
      const src = join(skillsSrc, name);
      const target = join(dir, name);
      cpSync(src, target, { recursive: true });
      const srcMd = readFileSync(join(src, "SKILL.md"), "utf8");
      writeFileSync(join(target, "SKILL.md"), skillToCursor(srcMd));
    }
    mkdirSync(join(repo, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(repo, ".cursor", "rules", "dai-constitution.mdc"), constitutionCursorRule());
    ok(`Cursor:       .cursor/skills/ (${skills.length}) + .cursor/rules/dai-constitution.mdc`);
  }

  // ── OpenSpec ───────────────────────────────────────────────────────────────
  // OpenSpec tiene modo NO-interactivo (`openspec init --tools <lista> --force`),
  // así que sí lo inicializamos nosotros — mapeando --for a sus tools. (Antes se
  // dejaba a medias porque se intentaba correr su modo interactivo anidado.)
  process.stdout.write("\n");
  const openspecPresent = () => { try { runNpmTool("openspec", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } };
  const osTools = [want.claude && "claude", want.copilot && "github-copilot", want.cursor && "cursor"]
    .filter(Boolean).join(",") || "claude,github-copilot,cursor";
  const osHint = "para sumarlo después:  npm i -g @fission-ai/openspec@latest  &&  openspec init --tools " + osTools;
  if (hasOpenspec) {
    ok(`OpenSpec:     ya inicializado en el repo — ${opsxHint(want)}`);
  } else if (openspecPartial) {
    warn("OpenSpec:     hay una carpeta openspec/ a medias. Reinicializa: rm -rf openspec && openspec init --tools " + osTools + " --force");
  } else if (installOpenspec) {
    let cliOk = openspecPresent();
    if (!cliOk) {
      try { info("OpenSpec:     instalando el CLI (npm i -g @fission-ai/openspec)…"); runNpmTool("npm", ["install", "-g", "@fission-ai/openspec@latest"], { stdio: "inherit" }); cliOk = openspecPresent(); }
      catch { cliOk = false; }
    }
    if (cliOk) {
      try {
        info(`OpenSpec:     inicializando en el repo (--tools ${osTools})…`);
        runNpmTool("openspec", ["init", "--tools", osTools, "--force"], { stdio: "inherit", cwd: repo === "." ? process.cwd() : repo });
        ok(`OpenSpec:     instalado e inicializado — genera design/tasks con ${opsxHint(want)}`);
      } catch {
        warn("OpenSpec:     el CLI está pero falló `openspec init`. Ejecuta a mano en el repo:");
        process.stdout.write(`                  openspec init --tools ${osTools} --force\n`);
      }
    } else {
      warn("OpenSpec:     no pude instalar el CLI. " + osHint);
    }
  } else {
    warn("OpenSpec:     omitido — " + osHint);
  }

  // ── Próximos pasos ─────────────────────────────────────────────────────────
  process.stdout.write("\n  " + C.y("✔") + " " + C.b("Repo configurado.") + " Próximos pasos:\n");
  process.stdout.write(pm === "md"
    ? `    1. Crea tu primera US en ${C.cy(".dai/us/<ID>.md")} (criterios bajo '## Criterios de aceptación')\n`
    : `    1. Copia ${C.cy(".env.dai.example")} → ${C.cy(".env.dai")} y completa el token de ${pm}; verifica con ${C.y("dai doctor")}\n`);
  process.stdout.write(`    2. ${C.y("dai link-us <ID>")}     → crea la branch + el link a la US\n`);
  process.stdout.write(`    3. Implementa con test primero, después: ${C.y("dai check")}\n`);
  process.stdout.write("    Guía paso a paso: https://github.com/dforce2055/dai/blob/main/docs/PROBAR.md\n\n");
}

// ── docs: documentación conceptual → <destino> ────────────────────────────────
function cmdDocs(dest) {
  if (!dest) fail("uso: dai docs <destino>");
  mkdirSync(dest, { recursive: true });
  // `public/` son los assets del sitio (VitePress), no documentación para leer desde el
  // repo de nadie: las capturas de los tutoriales ni siquiera viajan en el paquete npm
  // (issue #37). Se saltea, y los links que las nombran se absolutizan contra el sitio.
  cpSync(join(ROOT, "docs"), dest, { recursive: true, filter: (src) => !/[/\\]public([/\\]|$)/.test(src) });
  let reescritos = 0;
  for (const f of walkMd(dest)) {
    const md = readFileSync(f, "utf8");
    const out = absolutizeSiteLinks(md);
    if (out !== md) { writeFileSync(f, out); reescritos++; }
  }
  ok(`documentación copiada a ${dest}`);
  if (reescritos) info(`${reescritos} documento(s) con capturas: los links apuntan al sitio publicado.`);
}

// Los .md de un árbol, para la reescritura de links de cmdDocs.
function walkMd(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkMd(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// ── archive: funde los delta specs del change en los specs canónicos y lo archiva ─
// Lo corre el APROBADOR de la PR, en la branch, al aprobar: es el gate de aprobación
// (el fold va atado a la aprobación, no a la autoría). Envuelve `openspec archive
// <change> --yes` — mecánico, va al CLI y no a una skill (ADR-0002). El fold queda
// sin commitear para que el aprobador lo revise y lo incluya en la PR antes de mergear.
function cmdArchive(changeArg, opts) {
  const repo = process.cwd();
  if (!existsSync(join(repo, "openspec"))) fail("no hay OpenSpec en este repo (falta openspec/). Nada que archivar.", 2);

  let change = changeArg;
  if (!change) {
    // Detectar el change ACTIVO (no archivado) por su implements.yaml.
    const active = discoverImplements(repo, { includeArchived: false })
      .filter((f) => /[/\\]openspec[/\\]changes[/\\]/.test(f.path))
      .map((f) => basename(dirname(f.path)));
    const uniq = [...new Set(active)];
    if (uniq.length === 0) fail("no encontré un change activo para archivar (¿ya está archivado, o falta `dai link-us`?).", 2);
    if (uniq.length > 1) fail(`hay varios changes activos: ${uniq.join(", ")}.\n  Pasá cuál: dai archive <change>`, 2);
    change = uniq[0];
  }

  info(`archivando '${change}' — funde los delta specs en openspec/specs/ y mueve el change a archive/…`);
  const args = ["archive", change, "--yes"];
  if (opts.skipSpecs) args.push("--skip-specs");
  try {
    runNpmTool("openspec", args, { stdio: "inherit", cwd: repo });
  } catch (e) {
    fail(`openspec archive falló (¿tasks incompletas? ¿change inexistente?): ${String(e.message).split("\n")[0]}`, 1);
  }
  process.stdout.write("\n");
  ok(`'${change}' archivado. Revisá los cambios (specs fundidas + change en archive/) y commitealos en la PR antes de mergear.`);
}

// ── sync: refresca las copias scaffoldeadas a la versión del CLI (ADR-0010) ───
// Las copias (skills, constitución, templates, PR template) son un CACHÉ derivable
// del CLI: `dai sync` las re-genera a la versión instalada, aditivo (no pisa la
// constitución propia del proyecto). NO toca el `.env` ni OpenSpec. Opt-in.
function cmdSync(repo, opts) {
  repo = repo || ".";
  if (!existsSync(repo)) fail(`no existe el directorio: ${repo}`, 2);
  const daiDir = join(repo, ".dai");
  if (!existsSync(daiDir)) fail("este repo no tiene dai (falta .dai/). Corré `dai init` primero.", 2);

  // Asistentes: --for override, o detectar los que ya están en el repo.
  let want;
  if (typeof opts.for === "string") {
    try { want = parseAssistants(opts.for); } catch (e) { fail(`--for ${e.message}`); }
  } else {
    want = {
      claude: existsSync(join(repo, ".claude", "skills")),
      // .github/skills es el layout nativo (ADR-0014); .github/prompts es el viejo, que
      // seguimos detectando para migrar repos que quedaron en el formato anterior.
      copilot: existsSync(join(repo, ".github", "skills")) || existsSync(join(repo, ".github", "prompts")),
      cursor: existsSync(join(repo, ".cursor", "skills")),
    };
    if (!want.claude && !want.copilot && !want.cursor)
      fail("no detecté asistentes instalados (.claude/skills · .github/skills · .cursor/skills). Pasá --for.", 2);
  }

  const cliV = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  const repoV = existsSync(join(daiDir, "VERSION")) ? readFileSync(join(daiDir, "VERSION"), "utf8").trim() : "?";
  const dry = !!opts.dryRun;
  const forStr = [want.claude && "claude", want.copilot && "copilot", want.cursor && "cursor"].filter(Boolean).join("+");
  info(`dai sync — ${repoV} → v${cliV}  ·  asistentes: ${forStr}${dry ? "  [dry-run]" : ""}`);

  const skillsSrc = join(ROOT, "skills");
  const skills = readdirSync(skillsSrc).filter((n) => statSync(join(skillsSrc, n)).isDirectory());
  const step = (label, fn) => { if (dry) info(`[dry-run] ${label}`); else { fn(); ok(label); } };

  // 1. .dai/ (templates + governance) + VERSION
  step(`.dai/         moldes + governance → v${cliV}`, () => {
    for (const sub of ["templates", "governance"]) {
      const src = join(ROOT, sub);
      if (existsSync(src)) { mkdirSync(join(daiDir, sub), { recursive: true }); cpSync(src, join(daiDir, sub), { recursive: true }); }
    }
    writeFileSync(join(daiDir, "VERSION"), readFileSync(join(ROOT, "VERSION"), "utf8"));
  });

  // 2. PR template
  step(".github/      pull_request_template.md", () => {
    mkdirSync(join(repo, ".github"), { recursive: true });
    cpSync(join(ROOT, "templates", "pull-request.md"), join(repo, ".github", "pull_request_template.md"));
  });

  // 3. skills + constitución por asistente (aditivo: upsertBlock no pisa lo del proyecto)
  if (want.claude) step(`Claude:       .claude/skills/ (${skills.length}) + CLAUDE.md (bloque dai)`, () => {
    const dir = join(repo, ".claude", "skills"); mkdirSync(dir, { recursive: true });
    for (const name of skills) cpSync(join(skillsSrc, name), join(dir, name), { recursive: true });
    const cPath = join(repo, "CLAUDE.md"), cCur = existsSync(cPath) ? readFileSync(cPath, "utf8") : "";
    writeFileSync(cPath, upsertBlock(cCur, constitution("claude")));
  });
  if (want.copilot) step(`Copilot:      .github/skills/ (${skills.length}) + copilot-instructions.md`, () => {
    // Copilot lee SKILL.md nativo (ADR-0014): copia cruda, con templates/ — igual que `dai init`.
    const dir = join(repo, ".github", "skills"); mkdirSync(dir, { recursive: true });
    for (const name of skills) cpSync(join(skillsSrc, name), join(dir, name), { recursive: true });
    const ciPath = join(repo, ".github", "copilot-instructions.md"), ciCur = existsSync(ciPath) ? readFileSync(ciPath, "utf8") : "";
    writeFileSync(ciPath, upsertBlock(ciCur, constitution("copilot")));
    // Limpia los .prompt.md viejos de dai (ahora son skills nativas) para no duplicar cada /comando.
    const pdir = join(repo, ".github", "prompts");
    const stale = existsSync(pdir) ? stalePromptFiles(skills).filter((f) => existsSync(join(pdir, f))) : [];
    for (const f of stale) rmSync(join(pdir, f), { force: true });
  });
  if (want.cursor) step(`Cursor:       .cursor/skills/ (${skills.length}) + .cursor/rules/dai-constitution.mdc`, () => {
    const dir = join(repo, ".cursor", "skills"); mkdirSync(dir, { recursive: true });
    for (const name of skills) {
      const src = join(skillsSrc, name), target = join(dir, name);
      cpSync(src, target, { recursive: true });
      writeFileSync(join(target, "SKILL.md"), skillToCursor(readFileSync(join(src, "SKILL.md"), "utf8")));
    }
    mkdirSync(join(repo, ".cursor", "rules"), { recursive: true });
    writeFileSync(join(repo, ".cursor", "rules", "dai-constitution.mdc"), constitutionCursorRule());
  });

  // 4. .gitignore: versiona los artefactos, deja fuera solo lo personal
  const giPath = join(repo, ".gitignore");
  const gi = reconcileGitignore(existsSync(giPath) ? readFileSync(giPath, "utf8") : "", want);
  if (gi.changed) step(".gitignore    ajustado (artefactos versionados; settings.local.json fuera)",
    () => writeFileSync(giPath, gi.text.endsWith("\n") ? gi.text : gi.text + "\n"));

  if (dry) info("dry-run: nada escrito. Quitá --dry-run para aplicar.");
  else { process.stdout.write("\n"); ok(`sync completo — .dai/ ahora en v${cliV}`); process.stdout.write("  (El .env.dai y OpenSpec no se tocan: OpenSpec se actualiza aparte con `openspec`.)\n"); }
}

// Imprime el estado de version-drift del scaffold (ADR-0010) con color + ícono.
// Reutilizado por `dai doctor` y `dai version`. Devuelve el estado, o null si el
// directorio no tiene dai (.dai/VERSION). No imprime nada en ese caso.
function reportDrift(repo = process.cwd()) {
  const vf = join(repo, ".dai", "VERSION");
  if (!existsSync(vf)) return null;
  const repoV = readFileSync(vf, "utf8").trim();
  const cliV = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  const status = versionDrift(repoV, cliV);
  switch (status) {
    case "current":
      ok(`.dai/ al día con el CLI (v${repoV})`); break;
    case "minor-behind":
      process.stdout.write(`${C.b(C.y("⬆️  actualización disponible"))} — CLI ${C.b("v" + cliV)}, tu repo ${repoV}. Actualizá con ${C.cy("dai sync")} · probá con ${C.cy("dai sync --dry-run")}\n`); break;
    case "major-behind":
      process.stdout.write(`${C.b(C.r("⚠️  cambio MAYOR"))} — CLI ${C.b("v" + cliV)}, tu repo ${repoV}. Revisá el CHANGELOG/MIGRATION antes de ${C.cy("dai sync")}\n`); break;
    case "cli-behind":
      process.stdout.write(`${C.b(C.y("⚠️  CLI atrasado"))} — tu repo se scaffoldeó con v${repoV}, más nuevo que tu CLI (v${cliV}). Actualizá el CLI: ${C.cy("npm i -g @dforce2055/dai")}\n`); break;
    default:
      warn(`.dai/ VERSION ilegible: '${repoV}'`);
  }
  return status;
}

// ── upgrade: self-update del CLI global (ADR-0012) ────────────────────────────
// Actualiza el paquete npm global de dai a la última publicada. NO toca el repo:
// si hay drift del scaffold, solo lo reporta (el `dai sync` queda explícito, del
// mantenedor). El nombre sale de package.json → robusto si cambia el scope.
function cmdUpgrade(opts) {
  const name = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).name;
  const currentV = readFileSync(join(ROOT, "VERSION"), "utf8").trim();
  const manual = C.cy(`npm i -g ${name}@latest`);
  info(`dai upgrade — CLI v${currentV} (${name})`);

  let latestV;
  try {
    latestV = runNpmTool("npm", ["view", name, "version"], { encoding: "utf8" }).trim();
  } catch {
    fail(`no pude consultar el registry (¿sin red?). Actualizá a mano: ${manual}`, 1);
  }

  const plan = planUpgrade(currentV, latestV);
  if (plan.action === "unknown") { warn(`no pude comparar versiones (actual '${currentV}', última '${latestV}')`); return; }
  if (plan.action === "up-to-date") { ok(`ya estás en la última (v${currentV})`); reportDrift(); return; }
  if (plan.action === "ahead") { info(`tu CLI (v${currentV}) es más nuevo que el registry (v${latestV}) — nada que actualizar`); reportDrift(); return; }

  // plan.action === "upgrade"
  if (opts.check) { process.stdout.write(`${C.b(C.y("⬆️  hay update"))} — v${plan.from} → v${plan.to}. Corré ${C.cy("dai upgrade")}\n`); return; }
  if (opts.dryRun) { info(`[dry-run] correría: npm i -g ${name}@latest  (v${plan.from} → v${plan.to})`); return; }

  info(`actualizando v${plan.from} → v${plan.to} …`);
  try {
    runNpmTool("npm", ["install", "-g", `${name}@latest`], { stdio: "inherit" });
  } catch {
    fail(`el install falló. Probá a mano: ${manual}`, 1);
  }
  ok(`CLI actualizado a v${plan.to}`);
  const st = reportDrift();
  if (st === null) process.stdout.write("  (No estás en un repo dai — entrá al repo y, si hace falta, corré `dai sync`.)\n");
}

// ── doctor: diagnóstico ───────────────────────────────────────────────────────
function cmdDoctor() {
  loadDaiEnv();
  info(`dai doctor — versión v${readFileSync(join(ROOT, "VERSION"), "utf8").trim()}`);

  // Una skill sirve si está en el repo actual (la puso `dai init`) o global (la puso
  // `dai install`). Reportamos dónde — y SOLO de los asistentes que este repo usa: antes
  // se listaban los tres siempre, así que quien configuró uno veía 14 warnings de los
  // otros dos y leía "está todo roto" cuando estaba todo bien.
  const skillsRoot = join(ROOT, "skills");
  const skillNames = readdirSync(skillsRoot).filter((n) => statSync(join(skillsRoot, n)).isDirectory());
  const cwd = process.cwd();
  const ASSISTANTS = [
    { kind: "claude",  label: "Claude",  local: join(cwd, ".claude", "skills"),  global: CLAUDE_SKILLS_DIR,  home: "~/.claude/skills" },
    { kind: "copilot", label: "Copilot", local: join(cwd, ".github", "skills"),  global: COPILOT_SKILLS_DIR, home: "~/.copilot/skills" },
    { kind: "cursor",  label: "Cursor",  local: join(cwd, ".cursor", "skills"),  global: CURSOR_SKILLS_DIR,  home: "~/.cursor/skills" },
  ];
  const present = (a) => skillNames.some((n) => existsSync(join(a.local, n)) || existsSync(join(a.global, n)));
  const active = ASSISTANTS.filter(present);

  if (active.length === 0) {
    warn("no encontré skills de dai para ningún asistente.");
    process.stdout.write("    En un repo:  dai init --for claude|copilot|cursor|all\n");
    process.stdout.write("    O global:    dai install --for all\n");
  }
  for (const a of active) {
    info(`skills ${a.label} (repo local / global ${a.home}):`);
    for (const name of skillNames) {
      const local = existsSync(join(a.local, name)), global = existsSync(join(a.global, name));
      if (local && global) ok(`${name}  (local + global)`);
      else if (local) ok(`${name}  (local, este repo)`);
      else if (global) ok(`${name}  (global)`);
      else warn(`${name} — falta para ${a.label} (dai init --for ${a.kind}, o dai install --for ${a.kind})`);
    }
  }
  if (active.some((a) => a.kind === "copilot")) {
    const ci = join(cwd, ".github", "copilot-instructions.md");
    existsSync(ci) ? ok("constitución Copilot (.github/copilot-instructions.md)") : warn("falta la constitución de Copilot (dai init --for copilot)");
    // Los .prompt.md viejos duplican cada /comando con una copia sin templates.
    const pdir = join(cwd, ".github", "prompts");
    const stale = existsSync(pdir) ? stalePromptFiles(skillNames).filter((f) => existsSync(join(pdir, f))) : [];
    if (stale.length) warn(`${stale.length} .prompt.md viejo(s) en .github/prompts/ — duplican las skills. Corré \`dai init --for copilot\` para limpiarlos.`);
  }
  if (active.some((a) => a.kind === "cursor")) {
    const localRule = join(cwd, ".cursor", "rules", "dai-constitution.mdc");
    const globalRule = join(homedir(), ".cursor", "rules", "dai-constitution.mdc");
    if (existsSync(localRule) && existsSync(globalRule)) ok("constitución Cursor (local + global)");
    else if (existsSync(localRule)) ok("constitución Cursor (local)");
    else if (existsSync(globalRule)) ok("constitución Cursor (global)");
    else warn("falta constitución Cursor (dai-constitution.mdc)");
  }

  // OpenSpec: los comandos que arman el CÓMO. Se reportan acá porque su nombre CAMBIA
  // según el asistente, y con la forma equivocada el agente no falla — no encuentra nada,
  // no avisa, y se pone a improvisar salteándose el gate. Verlo escrito ahorra la tarde.
  const OPSX_IDS = ["explore", "propose", "apply", "archive"];
  const opsxPath = (kind, id) => join(cwd, ...OPSX_COMMAND_FILE[kind].replace("<id>", id).split("/"));
  // Solo los asistentes configurados EN ESTE REPO: los comandos opsx son archivos del
  // repo, así que tener las skills globales no dice nada sobre ellos. Avisar por los otros
  // dos le pone dos warnings falsos a quien configuró uno solo, que es el caso normal.
  const localActive = ASSISTANTS.filter((a) => skillNames.some((n) => existsSync(join(a.local, n))));
  if (localActive.length && existsSync(join(cwd, "openspec"))) {
    info("OpenSpec — los comandos van en el chat del asistente, no en la terminal:");
    for (const a of localActive) {
      const faltan = OPSX_IDS.filter((id) => !existsSync(opsxPath(a.kind, id)));
      if (faltan.length === OPSX_IDS.length) {
        warn(`${a.label}: no hay comandos opsx. Generalos:  openspec init --tools ${OPENSPEC_TOOL[a.kind]} --force`);
      } else {
        const hay = OPSX_IDS.filter((id) => existsSync(opsxPath(a.kind, id)));
        ok(`${a.label}: ${hay.map((id) => opsxCommand(a.kind, id)).join(" · ")}`);
        if (faltan.length) warn(`${a.label}: faltan ${faltan.join(", ")} — regenerá con \`openspec init --tools ${OPENSPEC_TOOL[a.kind]} --force\``);
      }
    }
    process.stdout.write("    (el nombre sale del archivo que genera OpenSpec: solo Claude usa los dos puntos)\n");
    // La versión importa para algo más que features: hasta OPENSPEC_MIN, los prompts que
    // OpenSpec genera para Copilot/Cursor decían `/opsx:apply` (la forma de Claude, que ahí
    // no existe) e invocaban herramientas que solo tiene Claude Code. El agente terminaba
    // nombrando comandos inexistentes y salteándose el gate de aprobación sin avisar.
    let osV = null;
    try { osV = String(runNpmTool("openspec", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) ?? "").trim(); } catch { /* sin CLI */ }
    if (!osV) info("el CLI de OpenSpec no está en el PATH (los comandos igual viven en el repo)");
    else if (compareVersions(osV, OPENSPEC_MIN) === -1) {
      warn(`OpenSpec ${osV} — actualiza a ${OPENSPEC_MIN} o mayor:  npm i -g @fission-ai/openspec@latest`);
      process.stdout.write("    Hasta esa versión, los prompts de Copilot y Cursor nombraban los comandos en la\n");
      process.stdout.write("    forma de Claude y pedían herramientas que esos asistentes no tienen: el agente se\n");
      process.stdout.write("    saltea el gate de aprobación y se pone a implementar sin avisar.\n");
    } else ok(`OpenSpec ${osV}`);
  }

  info("adaptador de PM:");
  const pm = process.env.DAI_PM || "md";
  ok(`DAI_PM=${pm}`);
  if (pm === "jira") {
    if (!process.env.DAI_JIRA_BASE_URL) warn("falta DAI_JIRA_BASE_URL en .env.dai");
    if (!process.env.DAI_JIRA_EMAIL) warn("falta DAI_JIRA_EMAIL en .env.dai");
    // Ojo: solo miramos que el token ESTÉ, no que sirva — uno vencido pasa este chequeo
    // y recién falla al publicar. Verificarlo de verdad es pegarle a la red.
    if (!process.env.DAI_JIRA_TOKEN) warn("falta DAI_JIRA_TOKEN en .env.dai"); else ok("token de Jira presente (no verificado: eso lo dice `dai publish`)");
    if (!process.env.DAI_JIRA_PROJECT) warn("DAI_JIRA_PROJECT vacío — solo hace falta para `dai publish` (crear issues)");
    else {
      try { ok(`proyecto=${assertProjectKey(process.env.DAI_JIRA_PROJECT)} (para dai publish)`); }
      catch (e) { warn(String(e.message)); }
    }
    // Campos propios del proyecto: que el archivo parsee ANTES de necesitarlo.
    const fpath = process.env.DAI_JIRA_FIELDS_FILE || join(".dai", "jira-fields.json");
    if (!existsSync(fpath)) info(`sin campos propios declarados (${fpath} no existe — normal si tu Jira no los exige)`);
    else {
      try {
        const spec = parseFieldsFile(readFileSync(fpath, "utf8"), fpath);
        const types = Object.keys(spec);
        ok(`campos propios: ${fpath} — issuetypes: ${types.length ? types.join(", ") : "(ninguno)"}`);
      } catch (e) { warn(String(e.message)); }
    }
  }
  if (pm === "clickup") {
    if (!process.env.DAI_CLICKUP_TOKEN) warn("falta DAI_CLICKUP_TOKEN en .env.dai"); else ok("token de ClickUp presente");
    process.env.DAI_CLICKUP_LIST_ID ? ok(`lista=${process.env.DAI_CLICKUP_LIST_ID} (para dai publish)`)
      : warn("DAI_CLICKUP_LIST_ID vacío — solo hace falta para `dai publish` (crear tareas)");
  }

  // ── forge: el CÓMO sale del repo por acá ─────────────────────────────────────
  // Si el push no sale, no hay PR; sin PR no hay link QUÉ↔CÓMO. El chequeo del cliente
  // ssh existe porque su modo de fallar miente: ver lib/git-ssh.mjs.
  const remote = gitRemote();
  info("forge:");
  if (!remote) warn("no hay remoto 'origin' — `dai pr` no tiene dónde publicar la branch");
  else {
    const p = parseRemote(remote);
    ok(`remoto origin: ${remote}${p ? `  (${detectForge(p.host)})` : ""}`);
    let sshConfig = null;
    try { sshConfig = git(["config", "--get", "core.sshCommand"]) || null; } catch { /* sin valor: git sale 1 */ }
    const d = diagnoseGitSsh({
      platform: process.platform,
      remote,
      config: sshConfig,
      env: { GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND, GIT_SSH: process.env.GIT_SSH },
      hasWindowsOpenSsh: existsSync(WINDOWS_OPENSSH),
    });
    if (d.status === "ok") ok(`git usa el OpenSSH de Windows (ve al ssh-agent)`);
    if (d.status === "ok-por-env") {
      ok(`git usa el OpenSSH de Windows (ve al ssh-agent)`);
      warn(`pero viene de ${d.source}, no del config: se pierde al cerrar la terminal.`);
      process.stdout.write(`    Para que quede:  git config --global core.sshCommand "${WINDOWS_OPENSSH}"\n`);
    }
    if (d.status === "bundled" || d.status === "otro-ssh") {
      warn(d.status === "bundled"
        ? "git usa su propio ssh (Git for Windows), que NO ve al ssh-agent de Windows."
        : `git usa ${d.bin} (por ${d.source}), que probablemente no vea al ssh-agent de Windows.`);
      process.stdout.write(`    Si tu clave tiene passphrase, cada push te la va a pedir — y si el prompt no llega,\n`);
      process.stdout.write(`    ssh cae a password y falla con "Permission denied (publickey…)", que acusa a la clave.\n`);
      if (d.fix) process.stdout.write(`    → git config --global core.sshCommand "${d.fix}"\n`);
      if (d.shadowed) process.stdout.write(`    Ojo: ${d.source} está seteada y pisa tu core.sshCommand. Límpiala primero.\n`);
    }
    if (d.status === "bundled-sin-openssh") {
      warn("git usa su propio ssh y no encontré el OpenSSH de Windows: si el push pide passphrase, instálalo (Configuración → Características opcionales → Cliente OpenSSH).");
    }
  }

  // ── flujo de branches: contra qué integra este repo, y qué rama es producción ──
  // Sin esto declarado, `dai pr` adivina la base — y en un repo con ramas de ambiente
  // adivinar significa proponer un merge a producción sin que nada lo destaque (issue #46).
  info("flujo de branches (dai pr · dai done):");
  const flow = branchFlow(process.env);
  if (flow.dev) ok(`integración: ${flow.dev}  (DAI_BRANCH_DEV) — ahí van las PR de feature/ y fix/`);
  else {
    const { base: adivinada, source: src } = resolveBase({ env: process.env, originHead: originHeadBranch() });
    warn(`sin DAI_BRANCH_DEV: las PR van a '${adivinada}', que sale de ${src}, no de tu config.`);
    process.stdout.write("    Declaralo una vez en el .env.dai:  DAI_BRANCH_DEV=<rama-que-integra>\n");
  }
  if (flow.prod) ok(`producción: ${flow.prod}  (DAI_BRANCH_PROD) — ahí van release/ y hotfix/, con confirmación explícita`);
  else info("sin DAI_BRANCH_PROD: dai no marca ninguna rama como producción (no adivina cuál es)");

  // ── version-drift del scaffold vs el CLI (ADR-0010) ──────────────────────────
  if (existsSync(join(process.cwd(), ".dai", "VERSION"))) { info("versión del scaffold:"); reportDrift(); }
}

// ── version ───────────────────────────────────────────────────────────────────
function cmdVersion() {
  process.stdout.write(`dai v${readFileSync(join(HERE, "..", "VERSION"), "utf8").trim()}\n`);
  reportDrift();   // en un repo con dai, avisa si el scaffold está atrasado (ADR-0010)
}

let [cmd, ...rest] = process.argv.slice(2);
if (cmd === "--version" || cmd === "-v") cmd = "version";
const { opts, pos } = parseFlags(rest);

// ── Convención de ayuda (vale para TODOS los comandos) ────────────────────────
// Pedir ayuda nunca ejecuta nada: sale por stdout y termina con 0. Antes el `--help`
// caía en `opts` y el comando corría igual — `dai stamp --help` dejaba un comentario en
// el tracker y `dai pr --help` publicaba una branch. Los agentes lo pisan seguido, porque
// probar `<cmd> --help` antes de usar un comando es exactamente lo que hay que hacer.
if (isHelpToken(cmd) || cmd === undefined || wantsHelp({ opts, pos })) {
  const { text, known } = helpFor(helpTopic(isHelpToken(cmd) ? null : cmd, pos));
  if (known) { process.stdout.write(text); process.exit(0); }
  process.stderr.write(`dai: no conozco el comando '${helpTopic(isHelpToken(cmd) ? null : cmd, pos)}'.\n\n`);
  process.stderr.write(text);
  process.exit(1);
}

switch (cmd) {
  case "ac-hash": cmdAcHash(pos[0]); break;
  case "ls":      cmdLs(opts); break;
  case "link-us": cmdLinkUs(pos[0], opts).catch((e) => failSoft(String(e.message))); break;
  case "check":   (opts.ci ? cmdCheckCi(opts) : cmdCheck()).catch((e) => failSoft(String(e.message))); break;
  case "stamp":   cmdStamp(pos, opts).catch((e) => failSoft(String(e.message))); break;
  case "update-us": cmdUpdateUs(pos[0], opts).catch((e) => failSoft(String(e.message))); break;
  case "edit-us": cmdEditUs(pos[0], opts).catch((e) => failSoft(String(e.message))); break;
  case "forge":   cmdForge(pos[0], pos[1], opts).catch((e) => failSoft(String(e.message))); break;
  case "publish": cmdPublish(pos[0], opts).catch((e) => failSoft(String(e.message))); break;
  case "pr":
  case "mr":      cmdPr(opts).catch((e) => failSoft(String(e.message))); break;   // `mr` = alias para GitLab (merge request)
  case "done":    cmdDone(opts); break;
  case "release":
    if (pos[0] === "plan") cmdReleasePlan(opts).catch((e) => failSoft(String(e.message)));
    else if (pos[0] === "cut") cmdReleaseCut(pos[1], opts).catch((e) => failSoft(String(e.message)));
    else if (pos[0] === "done") cmdReleaseDone(pos[1], opts).catch((e) => failSoft(String(e.message)));
    else if (pos[0] === "stamp") cmdReleaseStamp(pos[1], opts).catch((e) => failSoft(String(e.message)));
    else if (pos[0] === "status") cmdReleaseStatus(opts).catch((e) => failSoft(String(e.message)));
    else if (pos[0] === "notify") cmdReleaseNotify(opts).catch((e) => failSoft(String(e.message)));
    else fail(`subcomando de release desconocido: '${pos[0] ?? "(ninguno)"}' (plan | cut | done | stamp | status | notify)`, 2);
    break;
  case "archive": cmdArchive(pos[0], opts); break;
  case "install": cmdInstall(opts).catch((e) => failSoft(String(e.message))); break;   // alias de `dai skills install`
  case "skills":
    if (pos[0] === "install" || pos[0] === undefined) cmdInstall(opts).catch((e) => failSoft(String(e.message)));
    else fail(`subcomando de skills desconocido: '${pos[0]}' (por ahora: install)`, 2);
    break;
  case "init":    cmdInit(pos[0], opts).catch((e) => failSoft(String(e.message))); break;
  case "sync":    cmdSync(pos[0], opts); break;
  case "upgrade":
  case "update":  cmdUpgrade(opts); break;
  case "docs":    cmdDocs(pos[0]); break;
  case "doctor":  cmdDoctor(); break;
  case "version": cmdVersion(); break;
  default:
    // Comando desconocido: la ayuda global por stderr y salida ≠ 0 (la ayuda PEDIDA sale
    // por stdout y con 0, arriba). Distinguirlos es lo que deja `dai foo --help` usable
    // en un script sin tener que adivinar de dónde leer.
    process.stderr.write(`dai: no conozco el comando '${cmd}'.\n\n`);
    process.stderr.write(globalUsage());
    process.exit(1);
}
