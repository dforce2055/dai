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
import { loadEnv } from "./lib/env.mjs";
import { getAdapter, coverageStatus, statusLabel } from "./lib/pm-adapter.mjs";
import { branchUrl, commitUrl, parseRemote, detectForge } from "./lib/forge-url.mjs";
import { parsePrRef, getPR, postComment } from "./lib/forge-api.mjs";
import { composePrBody, prTitle, forgeTool } from "./lib/pr.mjs";
import { dirsEqual } from "./lib/fsutil.mjs";
import { parseFlags, parseAssistants, isAssistantToken, asList } from "./lib/args.mjs";
import { versionDrift, planUpgrade } from "./lib/semver.mjs";
import { parseSource } from "./lib/skills-source.mjs";
import { skillToCursor, validateSkill, constitution, constitutionCursorRule, envFor, mergeEnv, upsertBlock, reconcileGitignore, stalePromptFiles } from "./lib/bootstrap.mjs";
import { parseFieldsFile, parseFieldOverrides, resolveJiraFields } from "./lib/jira-fields.mjs";
import { assertProjectKey } from "./lib/pm-jira.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// No crashear si la salida se pipea a algo que cierra temprano (p. ej. `| head`).
process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(0); throw e; });

function fail(msg, code = 1) { process.stderr.write("dai: " + msg + "\n"); process.exit(code); }
const ok = (m) => process.stdout.write(`✓ ${m}\n`);
const info = (m) => process.stdout.write(`› ${m}\n`);
const warn = (m) => process.stdout.write(`⚠ ${m}\n`);
// Color ANSI mínimo — solo si es TTY y no está NO_COLOR (así no ensucia pipes/CI).
const _color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, m) => (_color ? `\x1b[${code}m${m}\x1b[0m` : m);
const C = { y: (m) => paint("33", m), r: (m) => paint("31", m), cy: (m) => paint("36", m), b: (m) => paint("1", m) };
const ROOT = join(HERE, "..");            // raíz del paquete dai (cli/ está adentro)
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
// En Windows los binarios instalados por npm (npm, openspec) son shims `.cmd` que
// execFileSync no resuelve solo. git/gh/glab son `.exe` y se resuelven normal.
const npmBin = (name) => (process.platform === "win32" ? `${name}.cmd` : name);
function trackerUrl(id) {
  const tpl = process.env.DAI_TRACKER_URL_TEMPLATE;
  return tpl ? tpl.replace("{id}", id) : id;
}

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
                  ac_hash: im.ac_hash, link: trackerUrl(im.id) });
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

  let title, hash, version = "v1";
  if (opts.us) {
    // Fuente local: un .md con la US.
    const md = readFileSync(opts.us, "utf8");
    hash = acHash(md);
    if (hash == null) fail(`la US en ${opts.us} no tiene una sección 'Criterios de aceptación' con criterios testeables → sin ac_hash.\n  Agregá los criterios bajo '## Criterios de aceptación', o corré /grill-user-story para pulir la US.`, 2);
    title = opts.title || extractTitle(md);
  } else {
    // Fuente tracker: traer la US del adaptador (mismo hash que usará `dai check`).
    loadEnv();
    const adapter = getAdapter(process.env);
    const us = await adapter.fetchUS(key);
    if (!us) fail(`no encontré la US ${key} en el backend ${adapter.kind}. Pasa --us <md> o revisa el .env.`, 2);
    hash = us.ac_hash;
    if (hash == null) fail(`la US ${key} no tiene una sección 'Criterios de aceptación' con criterios testeables → sin ac_hash, no se puede linkear.\n  Agregá la sección en el tracker, o corré /grill-user-story ${key} para pulir la US (te interroga y la re-publica).`, 2);
    title = opts.title || us.title;
    version = us.spec_version || "v1";
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

// ── check ──────────────────────────────────────────────────────────────────
async function cmdCheck() {
  loadEnv();
  const adapter = getAdapter(process.env);
  const found = discoverImplements(process.cwd(), { includeArchived: false });
  let worst = 0, n = 0;
  const atrasadas = [];
  for (const f of found) for (const im of f.implements || []) {
    if (isPlaceholderId(im.id)) continue;   // plantilla sin completar, no es una US real
    n++;
    const live = await adapter.fetchUS(im.id);
    const status = coverageStatus(im.ac_hash, live?.ac_hash);
    if (status === "al-dia") process.stdout.write(`✅ ${im.id} al día (${im.version})\n`);
    else if (status === "atrasado") {
      process.stdout.write(`⚠️  ${im.id} ATRASADO: implementaste ${im.ac_hash}, la US viva es ${live.ac_hash}${live.spec_version ? ` (${live.spec_version})` : ""}\n`);
      atrasadas.push(im.id);
      worst = Math.max(worst, 1);
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
  process.exit(worst);
}

// ── stamp ──────────────────────────────────────────────────────────────────
async function cmdStamp() {
  loadEnv();
  const adapter = getAdapter(process.env);
  const remote = gitRemote(), branch = gitBranch(), commit = gitCommit();
  const found = discoverImplements(process.cwd());
  let n = 0;
  for (const f of found) for (const im of f.implements || []) {
    if (isPlaceholderId(im.id)) continue;   // plantilla sin completar, no es una US real
    n++;
    const live = await adapter.fetchUS(im.id);
    const status = coverageStatus(im.ac_hash, live?.ac_hash);
    const record = {
      repo: f.repo, change: f.change, version: im.version, ac_hash: im.ac_hash, status,
      branch, branchUrl: branchUrl(remote, branch), commit, commitUrl: commitUrl(remote, commit),
    };
    const where = await adapter.stamp(im.id, record);
    process.stdout.write(`✓ ${im.id} → ${where}  (${statusLabel(status)})\n`);
  }
  if (n === 0) process.stdout.write("No hay implements.yaml para estampar.\n");
}

// ── forge (review) ───────────────────────────────────────────────────────────
async function cmdForge(sub, ref, opts) {
  loadEnv();
  const pr = parsePrRef(ref, gitRemote());
  if (!pr) fail("no pude resolver la PR/MR. Pasa la URL completa o el número (con remoto git).", 1);
  if (sub === "pr") {
    process.stdout.write(JSON.stringify(await getPR(pr, process.env), null, 2) + "\n");
  } else if (sub === "comment") {
    const body = opts.bodyFile ? readFileSync(opts.bodyFile, "utf8") : opts.body;
    if (!body) fail("falta --body-file <archivo> o --body <texto>.", 1);
    const res = await postComment(pr, body, process.env);
    process.stdout.write(`✓ comentario posteado${res.url ? `: ${res.url}` : ""}\n`);
  } else {
    fail("uso: dai forge <pr|comment> <ref> [--body-file f | --body t]", 1);
  }
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
  loadEnv();
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

// ── done: cierra una US — vuelve a la base, actualiza y borra la branch local ──
function cmdDone(opts) {
  const base = opts.base || "main";
  const branch = gitBranch();
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
  const usIds = [];
  for (const f of discoverImplements(process.cwd())) for (const im of f.implements || []) if (!isPlaceholderId(im.id)) usIds.push(im.id);

  // Ir a la base y actualizar.
  info(`Cambiando a '${base}' y actualizando…`);
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

// ── pr: crea TU PROPIA PR/MR precargada desde el template + el link ────────────
// (Distinto de dai-review, que revisa la PR de OTRO. Tu PR la creas y revisas tú.)
async function cmdPr(opts) {
  loadEnv();
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
    return (await _rl.question(q)).trim();
  };
  const closeRl = () => { if (_rl) { _rl.close(); _rl = null; } };

  // Elegir la branch base (default main). Se pregunta justo después del aviso de cambios.
  let base = opts.base;
  if (!base) { const ans = await ask("  ¿Contra qué branch va la PR? (main) "); base = ans || "main"; }

  // Sin commits sobre la base no hay PR.
  let ahead = null;
  try { ahead = Number(git(["rev-list", "--count", `${base}..HEAD`])); } catch { /* base no existe local */ }
  if (ahead === 0) {
    fail(`no hay commits en '${branch}' por encima de '${base}'. Una PR necesita cambios: haz commit primero (git commit).`, 1);
  }

  // 1. Resolver el link (US) de la branch actual.
  const found = discoverImplements(process.cwd());
  let entry = null;
  for (const f of found) for (const im of f.implements || []) {
    if (!isPlaceholderId(im.id)) { entry = { f, im }; break; }
  }
  if (!entry) fail("no encontré un implements.yaml con una US real. Ejecuta `dai link-us` primero.", 1);
  const { id, version, ac_hash } = entry.im;

  // 2. Estado de trazabilidad (dai check) contra la US viva.
  const adapter = getAdapter(process.env);
  const live = await Promise.resolve(adapter.fetchUS(id)).catch(() => null);
  const status = coverageStatus(ac_hash, live?.ac_hash);
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
  try { commits = git(["log", `${base}..HEAD`, "--pretty=%s"]).split("\n").filter(Boolean); } catch { /* base local ausente */ }
  const body = composePrBody(readFileSync(tplPath, "utf8"), {
    id, version, ac_hash, status, usUrl: trackerUrl(id), usTitle: live?.title, commits,
    branch, branchUrl: branchUrl(remote, branch), commit, commitUrl: commitUrl(remote, commit),
  });
  const title = prTitle(opts, id, live?.title);
  const forge = detectForge(parseRemote(remote)?.host);
  const tool = forgeTool(forge);

  // 4. Mostrar y pedir confirmación (acción hacia afuera).
  process.stdout.write(`\n  ── Pull Request a crear ──────────────────────────────\n`);
  process.stdout.write(`  título:   ${title}\n  de:       ${branch}\n  a:        ${base}\n`);
  process.stdout.write(`  forge:    ${forge} (${tool})${opts.assignee ? `\n  asignar:  ${opts.assignee}` : ""}${opts.draft ? "\n  draft:    sí" : ""}\n`);
  process.stdout.write(`  ─────────────────────────────────────────────────────\n\n${body}\n`);
  process.stdout.write(`  ─────────────────────────────────────────────────────\n`);

  // Archivo de paso para gh/glab: en el temp del sistema, NO en el repo (no lo ensucia).
  const bodyFile = join(mkdtempSync(join(tmpdir(), "dai-pr-")), "body.md");
  if (!opts.yes) {
    if (!process.stdin.isTTY) { closeRl(); writeFileSync(bodyFile, body); info(`Body guardado en ${bodyFile}. Revisa y re-ejecuta con --yes para crear.`); return; }
    const a = (await ask(`  ¿Publico la branch y creo el PR con ${tool}? (s/N) `) || "").toLowerCase();
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
    git(["push", "-u", "origin", branch]);
  } catch (e) { fail(`no pude pushear la branch: ${String(e.message).split("\n")[0]}`, 1); }

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
    if (/no history in common|no commits between|not found.*base|base.*not found/i.test(msg)) {
      warn(`la branch no comparte historia con '${base}' en el remoto (o '${base}' no existe allá).`);
      process.stdout.write(`  Suele pasar cuando el repo local y el remoto son distintos. Empuja la base primero:\n    git push origin ${base}\n  y vuelve a correr:  dai pr\n`);
    } else {
      warn(`no pude crear la PR con ${tool} (¿instalado y autenticado?). El body quedó en ${bodyFile}.`);
      process.stdout.write(`  Comando listo para correr a mano:\n    ${tool} ${cmd.map((c) => /\s/.test(c) ? `'${c}'` : c).join(" ")}\n`);
    }
  }
}

// ── install: skills → ~/.claude/skills o <repo>/.claude/skills ────────────────
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
    fail("--from necesita una fuente: un git URL (github.com/org/skills[#ref]) o un path local", 2);
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
      const pdir = join(repo, ".github", "prompts"); mkdirSync(pdir, { recursive: true });
      writeFileSync(join(pdir, `${name}.prompt.md`), skillToPrompt(md));
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

  process.stdout.write("\n  dai · configurar este repo para desarrollo asistido por IA\n");

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
    process.stdout.write("  (comandos /opsx:*). No está en este repo — la trazabilidad de dai anda igual sin\n");
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

  // .env.example — aditivo, reflejando el --pm elegido: mismas claves que el .env
  // (con valores VACÍOS, sin secretos) para que el token del tracker esté presente.
  const exSrc = envFor(pm);
  const exPath = join(repo, ".env.example");
  if (existsSync(exPath)) {
    const cur = readFileSync(exPath, "utf8"), merged = mergeEnv(cur, exSrc);
    if (merged !== cur) { writeFileSync(exPath, merged); ok(".env.example  claves de dai agregadas (aditivo)"); }
    else ok(".env.example  ya tenía la config de dai");
  } else { writeFileSync(exPath, exSrc); ok(".env.example  creado"); }

  // .env — aditivo: agrega las claves de dai que falten; si no existe, lo crea.
  const envPath = join(repo, ".env"), envBlock = envFor(pm);
  if (existsSync(envPath)) {
    const cur = readFileSync(envPath, "utf8"), merged = mergeEnv(cur, envBlock);
    if (merged !== cur) { writeFileSync(envPath, merged); ok(`.env          claves de dai agregadas (aditivo, DAI_PM=${pm}${pm === "md" ? "" : " — completa el token"})`); }
    else ok(".env          ya tenía la config de dai");
  } else { writeFileSync(envPath, envBlock); ok(`.env          listo, DAI_PM=${pm}${pm === "md" ? "" : " (completa el token)"}`); }

  // .gitignore — versiona los artefactos de dai (según --for), deja fuera solo lo personal.
  const giPath = join(repo, ".gitignore");
  const gi = reconcileGitignore(existsSync(giPath) ? readFileSync(giPath, "utf8") : "", want);
  if (gi.changed) { writeFileSync(giPath, gi.text.endsWith("\n") ? gi.text : gi.text + "\n"); ok(".gitignore    ajustado (skills/constitución versionadas; .env y settings.local.json fuera)"); }

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
  const openspecPresent = () => { try { execFileSync(npmBin("openspec"), ["--version"], { stdio: "ignore" }); return true; } catch { return false; } };
  const osTools = [want.claude && "claude", want.copilot && "github-copilot", want.cursor && "cursor"]
    .filter(Boolean).join(",") || "claude,github-copilot,cursor";
  const osHint = "para sumarlo después:  npm i -g @fission-ai/openspec@latest  &&  openspec init --tools " + osTools;
  if (hasOpenspec) {
    ok("OpenSpec:     ya inicializado en el repo");
  } else if (openspecPartial) {
    warn("OpenSpec:     hay una carpeta openspec/ a medias. Reinicializa: rm -rf openspec && openspec init --tools " + osTools + " --force");
  } else if (installOpenspec) {
    let cliOk = openspecPresent();
    if (!cliOk) {
      try { info("OpenSpec:     instalando el CLI (npm i -g @fission-ai/openspec)…"); execFileSync(npmBin("npm"), ["install", "-g", "@fission-ai/openspec@latest"], { stdio: "inherit" }); cliOk = openspecPresent(); }
      catch { cliOk = false; }
    }
    if (cliOk) {
      try {
        info(`OpenSpec:     inicializando en el repo (--tools ${osTools})…`);
        execFileSync(npmBin("openspec"), ["init", "--tools", osTools, "--force"], { stdio: "inherit", cwd: repo === "." ? process.cwd() : repo });
        ok("OpenSpec:     instalado e inicializado — genera design/tasks con /opsx:*");
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
  process.stdout.write("\n  ✔ Repo configurado. Próximos pasos:\n");
  process.stdout.write(pm === "md"
    ? "    1. Crea tu primera US en .dai/us/<ID>.md (criterios bajo '## Criterios de aceptación')\n"
    : `    1. Completa el token de ${pm} en .env, y verifica con: dai doctor\n`);
  process.stdout.write("    2. dai link-us <ID>     → crea la branch + el link a la US\n");
  process.stdout.write("    3. Implementa con test primero, después: dai check\n");
  process.stdout.write("    Guía paso a paso: https://github.com/dforce2055/dai/blob/main/docs/PROBAR.md\n\n");
}

// ── docs: documentación conceptual → <destino> ────────────────────────────────
function cmdDocs(dest) {
  if (!dest) fail("uso: dai docs <destino>");
  mkdirSync(dest, { recursive: true });
  cpSync(join(ROOT, "docs"), dest, { recursive: true });
  ok(`documentación copiada a ${dest}`);
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
    execFileSync(npmBin("openspec"), args, { stdio: "inherit", cwd: repo });
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
      copilot: existsSync(join(repo, ".github", "prompts")),
      cursor: existsSync(join(repo, ".cursor", "skills")),
    };
    if (!want.claude && !want.copilot && !want.cursor)
      fail("no detecté asistentes instalados (.claude/.cursor/.github/prompts). Pasá --for.", 2);
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
  if (want.copilot) step(`Copilot:      .github/prompts/ (${skills.length}) + copilot-instructions.md`, () => {
    const pdir = join(repo, ".github", "prompts"); mkdirSync(pdir, { recursive: true });
    for (const name of skills) writeFileSync(join(pdir, `${name}.prompt.md`), skillToPrompt(readFileSync(join(skillsSrc, name, "SKILL.md"), "utf8")));
    const ciPath = join(repo, ".github", "copilot-instructions.md"), ciCur = existsSync(ciPath) ? readFileSync(ciPath, "utf8") : "";
    writeFileSync(ciPath, upsertBlock(ciCur, constitution("copilot")));
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
  else { process.stdout.write("\n"); ok(`sync completo — .dai/ ahora en v${cliV}`); process.stdout.write("  (El .env y OpenSpec no se tocan: OpenSpec se actualiza aparte con `openspec`.)\n"); }
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
    latestV = execFileSync(npmBin("npm"), ["view", name, "version"], { encoding: "utf8" }).trim();
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
    execFileSync(npmBin("npm"), ["install", "-g", `${name}@latest`], { stdio: "inherit" });
  } catch {
    fail(`el install falló. Probá a mano: ${manual}`, 1);
  }
  ok(`CLI actualizado a v${plan.to}`);
  const st = reportDrift();
  if (st === null) process.stdout.write("  (No estás en un repo dai — entrá al repo y, si hace falta, corré `dai sync`.)\n");
}

// ── doctor: diagnóstico ───────────────────────────────────────────────────────
function cmdDoctor() {
  loadEnv();
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

  info("adaptador de PM:");
  const pm = process.env.DAI_PM || "md";
  ok(`DAI_PM=${pm}`);
  if (pm === "jira") {
    if (!process.env.DAI_JIRA_BASE_URL) warn("falta DAI_JIRA_BASE_URL en el .env");
    if (!process.env.DAI_JIRA_EMAIL) warn("falta DAI_JIRA_EMAIL en el .env");
    // Ojo: solo miramos que el token ESTÉ, no que sirva — uno vencido pasa este chequeo
    // y recién falla al publicar. Verificarlo de verdad es pegarle a la red.
    if (!process.env.DAI_JIRA_TOKEN) warn("falta DAI_JIRA_TOKEN en el .env"); else ok("token de Jira presente (no verificado: eso lo dice `dai publish`)");
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
    if (!process.env.DAI_CLICKUP_TOKEN) warn("falta DAI_CLICKUP_TOKEN en el .env"); else ok("token de ClickUp presente");
    process.env.DAI_CLICKUP_LIST_ID ? ok(`lista=${process.env.DAI_CLICKUP_LIST_ID} (para dai publish)`)
      : warn("DAI_CLICKUP_LIST_ID vacío — solo hace falta para `dai publish` (crear tareas)");
  }

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
if (cmd === "--help" || cmd === "-h") cmd = "help";
const { opts, pos } = parseFlags(rest);
switch (cmd) {
  case "ac-hash": cmdAcHash(pos[0]); break;
  case "ls":      cmdLs(opts); break;
  case "link-us": cmdLinkUs(pos[0], opts).catch((e) => fail(String(e.message))); break;
  case "check":   cmdCheck().catch((e) => fail(String(e.message))); break;
  case "stamp":   cmdStamp().catch((e) => fail(String(e.message))); break;
  case "forge":   cmdForge(pos[0], pos[1], opts).catch((e) => fail(String(e.message))); break;
  case "publish": cmdPublish(pos[0], opts).catch((e) => fail(String(e.message))); break;
  case "pr":      cmdPr(opts).catch((e) => fail(String(e.message))); break;
  case "done":    cmdDone(opts); break;
  case "archive": cmdArchive(pos[0], opts); break;
  case "install": cmdInstall(opts).catch((e) => fail(String(e.message))); break;   // alias de `dai skills install`
  case "skills":
    if (pos[0] === "install" || pos[0] === undefined) cmdInstall(opts).catch((e) => fail(String(e.message)));
    else fail(`subcomando de skills desconocido: '${pos[0]}' (por ahora: install)`, 2);
    break;
  case "init":    cmdInit(pos[0], opts).catch((e) => fail(String(e.message))); break;
  case "sync":    cmdSync(pos[0], opts); break;
  case "upgrade":
  case "update":  cmdUpgrade(opts); break;
  case "docs":    cmdDocs(pos[0]); break;
  case "doctor":  cmdDoctor(); break;
  case "version": cmdVersion(); break;
  default:
    process.stderr.write(
      "Uso: dai <comando> [args]\n\n" +
      "Trazabilidad:\n" +
      "  ac-hash <us.md>              calcula el ac_hash (ADR-0001)\n" +
      "  ls [--json]                  lista lo que implementa el repo (ADR-0005)\n" +
      "  publish <us.md>              crea la US en el tracker (Jira/ClickUp/md) y devuelve el key\n" +
      "      [--parent KEY]           la cuelga de su épica · [--issuetype T] p. ej. Epic\n" +
      "      [--field alias=valor]    campos propios que exige tu Jira (.dai/jira-fields.json); repetible\n" +
      "  link-us <KEY> [--us <md>]    crea branch + implements.yaml; sin --us trae la US del tracker (ADR-0004)\n" +
      "  link-us <KEY> --resync       re-estampa el ac_hash contra la US viva (tras un ⚠️ de check)\n" +
      "  check                        compara vs la US viva → atrasado (ADR-0003)\n" +
      "  stamp                        estampa la cobertura en el tracker (ADR-0005)\n" +
      "  done [--base main] [--force] cierra la US: vuelve a la base, actualiza y borra la branch local (si está mergeada)\n" +
      "  archive [<change>] [--skip-specs]   funde los delta specs del change en las specs canónicas y lo archiva (lo corre el aprobador en la PR)\n" +
      "  pr [--assignee u] [--base b] [--draft] [--yes]   crea TU PR/MR precargada (muestra + confirma)\n" +
      "  forge comment <ref> --body-file <f> · forge pr <ref>   comentar/leer una PR ajena (github/gitlab)\n\n" +
      "Instalación:\n" +
      "  skills install [--global | --local <repo>] [--force] [--dry-run] [--for <asistentes>]   instala las skills de dai (alias: `install`)\n" +
      "  skills install --from <git-url|path>[#ref] [--for <asistentes>]   instala skills EXTERNAS (por-stack), convertidas para los 3 asistentes (ADR-0013)\n" +
      "  init [<repo>]                scaffolder interactivo del repo (asistente, gestor, OpenSpec)\n" +
      "       --for <asistentes>      claude|copilot|cursor (combinables con coma) · o both|all (default all)\n" +
      "                               ej: --for claude,cursor · --for copilot · --for all\n" +
      "       --pm md|jira|clickup · --openspec   (con flags salteas las preguntas)\n" +
      "  sync [<repo>] [--dry-run] [--for <asistentes>]   refresca skills/constitución/templates a la versión del CLI (aditivo; no toca .env ni OpenSpec)\n" +
      "  upgrade [--check] [--dry-run]   (alias: update) actualiza el CLI global a la última (npm i -g …@latest) y avisa si el repo quedó atrasado (ADR-0012)\n" +
      "  docs <destino>               documentación conceptual → <destino>\n" +
      "  doctor                       diagnóstico del entorno\n\n" +
      "  (config: .env — ver .env.example)\n"
    );
    process.exit(cmd && cmd !== "help" ? 1 : 0);
}
