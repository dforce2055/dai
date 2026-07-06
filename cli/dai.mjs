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
import { parseFlags } from "./lib/args.mjs";
import { skillToPrompt, constitution, envFor } from "./lib/bootstrap.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

// No crashear si la salida se pipea a algo que cierra temprano (p. ej. `| head`).
process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(0); throw e; });

function fail(msg, code = 1) { process.stderr.write("dai: " + msg + "\n"); process.exit(code); }
const ok = (m) => process.stdout.write(`✓ ${m}\n`);
const info = (m) => process.stdout.write(`› ${m}\n`);
const warn = (m) => process.stdout.write(`⚠ ${m}\n`);
const ROOT = join(HERE, "..");            // raíz del paquete dai (cli/ está adentro)
const SKILLS_DIR = process.env.CLAUDE_SKILLS_DIR || join(homedir(), ".claude", "skills");
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
  if (h == null) fail("la US no tiene bloque de 'Criterios de aceptación'.", 2);
  process.stdout.write(h + "\n");
}

// ── ls ──────────────────────────────────────────────────────────────────────
function cmdLs(opts) {
  const root = opts.root || process.cwd();
  const found = discoverImplements(root);
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
    if (hash == null) fail("la US no tiene 'Criterios de aceptación' → no se puede calcular ac_hash.", 2);
    title = opts.title || extractTitle(md);
  } else {
    // Fuente tracker: traer la US del adaptador (mismo hash que usará `dai check`).
    loadEnv();
    const adapter = getAdapter(process.env);
    const us = await adapter.fetchUS(key);
    if (!us) fail(`no encontré la US ${key} en el backend ${adapter.kind}. Pasá --us <md> o revisá el .env.`, 2);
    hash = us.ac_hash;
    if (hash == null) fail(`la US ${key} no tiene 'Criterios de aceptación' → sin ac_hash.`, 2);
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
    warn("revisá si tu implementación cubre el criterio nuevo, y corré tus tests.");
    return;
  }

  if (!title) fail("no pude extraer el título de la US; pasá --title.", 1);
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
  const found = discoverImplements(process.cwd());
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
    process.stdout.write("  Después, revisá si tu implementación cubre el criterio nuevo.\n");
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
  if (!pr) fail("no pude resolver la PR/MR. Pasá la URL completa o el número (con remoto git).", 1);
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
async function cmdPublish(file) {
  if (!file) fail("uso: dai publish <archivo-us.md>", 1);
  loadEnv();
  const md = readFileSync(file, "utf8");
  const title = extractTitle(md);
  if (!title) fail("no pude extraer el título de la US (falta un '# Título').", 1);
  const adapter = getAdapter(process.env);
  if (typeof adapter.createUS !== "function") fail(`el backend '${adapter.kind}' no soporta crear US.`, 1);
  const r = await adapter.createUS({ title, descriptionMarkdown: md });
  ok(`US publicada en ${adapter.kind}: ${r.id}${r.url ? `  →  ${r.url}` : ""}`);
  info(`Próximo paso (el dev abre el CÓMO):  dai link-us ${r.id}`);
}

// ── pr: crea TU PROPIA PR/MR precargada desde el template + el link ────────────
// (Distinto de dai-review, que revisa la PR de OTRO. Tu PR la creás y revisás vos.)
async function cmdPr(opts) {
  loadEnv();
  const remote = gitRemote(), branch = gitBranch(), commit = gitCommit();
  if (!remote) fail("no hay remoto git 'origin'. Configuralo para crear la PR.", 1);
  if (!branch || branch === "HEAD") fail("no estás en una branch.", 1);

  // 0. Estado del repo: primero avisar cambios sueltos; después elegir la base.
  const dirty = (() => { try { return git(["status", "--porcelain"]).length > 0; } catch { return false; } })();
  if (dirty) {
    warn("tenés cambios SIN commitear — NO van a entrar en la PR. Commiteá lo que falte antes de crearla.");
    if (!opts.yes && !process.stdin.isTTY) fail("working tree sucio (usá --yes para ignorarlo, pero commiteá primero).", 1);
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
    fail(`no hay commits en '${branch}' por encima de '${base}'. Una PR necesita cambios: commiteá primero (git commit).`, 1);
  }

  // 1. Resolver el link (US) de la branch actual.
  const found = discoverImplements(process.cwd());
  let entry = null;
  for (const f of found) for (const im of f.implements || []) {
    if (!isPlaceholderId(im.id)) { entry = { f, im }; break; }
  }
  if (!entry) fail("no encontré un implements.yaml con una US real. Corré `dai link-us` primero.", 1);
  const { id, version, ac_hash } = entry.im;

  // 2. Estado de trazabilidad (dai check) contra la US viva.
  const adapter = getAdapter(process.env);
  const live = await Promise.resolve(adapter.fetchUS(id)).catch(() => null);
  const status = coverageStatus(ac_hash, live?.ac_hash);
  if (status === "atrasado") {
    warn(`la US ${id} está ATRASADA respecto de tu implementación (${ac_hash} ≠ ${live?.ac_hash}).`);
    warn(`resincronizá antes de abrir la PR:  dai link-us ${id} --resync`);
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
    if (!process.stdin.isTTY) { closeRl(); writeFileSync(bodyFile, body); info(`Body guardado en ${bodyFile}. Revisá y re-corré con --yes para crear.`); return; }
    const a = (await ask(`  ¿Publico la branch y creo el PR con ${tool}? (s/N) `) || "").toLowerCase();
    closeRl();
    if (!["s", "si", "sí", "y", "yes"].includes(a)) {
      writeFileSync(bodyFile, body);
      warn(`cancelado. Guardé el body en ${bodyFile} por si querés editarlo o crearla a mano.`);
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
    ok("PR/MR creada. Revisala vos y asigná el reviewer si falta.");
    try { rmSync(bodyFile); } catch { /* noop */ }
  } catch (e) {
    const msg = String(e.stderr || e.message || "");
    if (/no history in common|no commits between|not found.*base|base.*not found/i.test(msg)) {
      warn(`la branch no comparte historia con '${base}' en el remoto (o '${base}' no existe allá).`);
      process.stdout.write(`  Suele pasar cuando el repo local y el remoto son distintos. Empujá la base primero:\n    git push origin ${base}\n  y volvé a correr:  dai pr\n`);
    } else {
      warn(`no pude crear la PR con ${tool} (¿instalado y autenticado?). El body quedó en ${bodyFile}.`);
      process.stdout.write(`  Comando listo para correr a mano:\n    ${tool} ${cmd.map((c) => /\s/.test(c) ? `'${c}'` : c).join(" ")}\n`);
    }
  }
}

// ── install: skills → ~/.claude/skills o <repo>/.claude/skills ────────────────
async function cmdInstall(opts) {
  const skillsSrc = join(ROOT, "skills");
  const skills = readdirSync(skillsSrc).filter((n) => statSync(join(skillsSrc, n)).isDirectory());
  const interactive = process.stdin.isTTY && !opts.global && opts.local === undefined;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

  const scopeFor = async (name) => {
    if (opts.global) return { scope: "global" };
    if (opts.local !== undefined) return { scope: "local", repo: typeof opts.local === "string" ? opts.local : process.cwd() };
    const a = (await rl.question(`¿Dónde instalar '${name}'? [g]lobal · [l]ocal · [s]altar (g) `)).trim().toLowerCase();
    return a === "l" ? { scope: "local", repo: process.cwd() } : a === "s" ? { scope: "skip" } : { scope: "global" };
  };

  info(`Instalando skills de dai`);
  for (const name of skills) {
    const { scope, repo } = await scopeFor(name);
    if (scope === "skip") { warn(`salto ${name}`); continue; }
    const targetDir = scope === "local" ? join(repo, ".claude", "skills") : SKILLS_DIR;
    const src = join(skillsSrc, name), target = join(targetDir, name);
    if (existsSync(target)) {
      if (dirsEqual(src, target)) { ok(`${name} — ya instalada e idéntica, salto`); continue; }
      if (!opts.force) {
        if (!interactive) { warn(`${name} existe y difiere — salto (usá --force)`); continue; }
        const a = (await rl.question(`   ${name} existe y DIFIERE. ¿[p]isar · [s]altar? (s) `)).trim().toLowerCase();
        if (a !== "p") { warn(`salto ${name}`); continue; }
      }
    }
    if (opts.dryRun) { info(`[dry-run] ${name} → ${targetDir}`); continue; }
    rmSync(target, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    cpSync(src, target, { recursive: true });
    ok(`${name} → ${targetDir}`);
  }
  if (rl) rl.close();
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

// Asegura que ciertas entradas estén en el .gitignore del repo (crea o agrega).
function ensureGitignored(repo, entries) {
  const gi = join(repo, ".gitignore");
  const cur = existsSync(gi) ? readFileSync(gi, "utf8") : "";
  const have = new Set(cur.split(/\r?\n/).map((s) => s.trim()));
  const add = entries.filter((e) => !have.has(e));
  if (add.length === 0) return false;
  writeFileSync(gi, cur + (cur && !cur.endsWith("\n") ? "\n" : "") + "\n# dai — secretos, no commitear\n" + add.join("\n") + "\n");
  return true;
}

// ── init: scaffolder interactivo del repo ─────────────────────────────────────
async function cmdInit(repo, opts) {
  repo = repo || ".";   // por defecto, el directorio actual (como git init / npm init)
  if (!existsSync(repo)) fail(`no existe el directorio: ${repo}`);
  const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stdout }) : null;

  process.stdout.write("\n  dai · configurar este repo para desarrollo asistido por IA\n");

  // Preguntas primero (después cerramos readline para liberar stdin a los instaladores).
  let forOpt = typeof opts.for === "string" ? opts.for.toLowerCase() : null;
  if (!forOpt && rl) forOpt = await askMenu(rl, "¿Para qué asistente de IA preparo el repo? (genera las skills en su formato)", [
    { value: "both", label: "Claude + Copilot — equipo mixto (recomendado ante la duda)" },
    { value: "claude", label: "Solo Claude (Code / Desktop)" },
    { value: "copilot", label: "Solo Copilot (en VS Code / JetBrains)" },
  ], "both");
  forOpt = forOpt || "both";
  if (!["claude", "copilot", "both"].includes(forOpt)) fail(`--for inválido: '${forOpt}' (claude|copilot|both)`);

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
    installOpenspec = await askYesNo(rl, "¿Instalar el CLI de OpenSpec ahora? (después corrés `openspec init` vos)", false);
  }

  if (rl) rl.close();

  // ── Generación ───────────────────────────────────────────────────────────────
  const wantClaude = forOpt !== "copilot";
  const wantCopilot = forOpt !== "claude";
  process.stdout.write("\n  Configurando…\n\n");

  const dai = join(repo, ".dai");
  for (const sub of ["templates", "governance"]) {
    const src = join(ROOT, sub);
    if (existsSync(src)) { mkdirSync(join(dai, sub), { recursive: true }); cpSync(src, join(dai, sub), { recursive: true }); }
  }
  writeFileSync(join(dai, "VERSION"), readFileSync(join(ROOT, "VERSION"), "utf8"));
  ok(".dai/         moldes (templates) + reglas (governance) del método");

  cpSync(join(ROOT, ".env.example"), join(repo, ".env.example"));
  const envPath = join(repo, ".env");
  if (existsSync(envPath)) warn(".env          ya existe — lo dejo como está");
  else { writeFileSync(envPath, envFor(pm)); ok(`.env          listo, DAI_PM=${pm}${pm === "md" ? "" : " (completá el token)"}`); }
  if (ensureGitignored(repo, [".env"])) ok(".gitignore    .env agregado (los tokens NO se commitean)");

  mkdirSync(join(repo, ".github"), { recursive: true });
  cpSync(join(ROOT, "templates", "pull-request.md"), join(repo, ".github", "pull_request_template.md"));
  ok(".github/      pull_request_template.md — molde de PR atado al link");

  const skillsSrc = join(ROOT, "skills");
  const skills = readdirSync(skillsSrc).filter((n) => statSync(join(skillsSrc, n)).isDirectory());

  if (wantClaude) {
    const dir = join(repo, ".claude", "skills");
    mkdirSync(dir, { recursive: true });
    for (const name of skills) cpSync(join(skillsSrc, name), join(dir, name), { recursive: true });
    writeFileSync(join(repo, "CLAUDE.md"), constitution("claude"));
    ok(`Claude:       .claude/skills/ (${skills.length}) + CLAUDE.md → conoce el método y las skills`);
  }
  if (wantCopilot) {
    const pdir = join(repo, ".github", "prompts");
    mkdirSync(pdir, { recursive: true });
    for (const name of skills) writeFileSync(join(pdir, `${name}.prompt.md`), skillToPrompt(readFileSync(join(skillsSrc, name, "SKILL.md"), "utf8")));
    writeFileSync(join(repo, ".github", "copilot-instructions.md"), constitution("copilot"));
    ok(`Copilot:      .github/prompts/ (${skills.length}) + copilot-instructions.md`);
  }

  // ── OpenSpec ───────────────────────────────────────────────────────────────
  // OpenSpec tiene modo NO-interactivo (`openspec init --tools <lista> --force`),
  // así que sí lo inicializamos nosotros — mapeando --for a sus tools. (Antes se
  // dejaba a medias porque se intentaba correr su modo interactivo anidado.)
  process.stdout.write("\n");
  const openspecPresent = () => { try { execFileSync(npmBin("openspec"), ["--version"], { stdio: "ignore" }); return true; } catch { return false; } };
  const osTools = { claude: "claude", copilot: "github-copilot", both: "claude,github-copilot" }[forOpt] || "claude,github-copilot";
  const osHint = "para sumarlo después:  npm i -g @fission-ai/openspec@latest  &&  openspec init --tools " + osTools;
  if (hasOpenspec) {
    ok("OpenSpec:     ya inicializado en el repo");
  } else if (openspecPartial) {
    warn("OpenSpec:     hay una carpeta openspec/ a medias. Reinicializá: rm -rf openspec && openspec init --tools " + osTools + " --force");
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
        ok("OpenSpec:     instalado e inicializado — generá design/tasks con /opsx:*");
      } catch {
        warn("OpenSpec:     el CLI está pero falló `openspec init`. Corré a mano en el repo:");
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
    ? "    1. Creá tu primera US en .dai/us/<ID>.md (criterios bajo '## Criterios de aceptación')\n"
    : `    1. Completá el token de ${pm} en .env, y verificá con: dai doctor\n`);
  process.stdout.write("    2. dai link-us <ID>     → crea la branch + el link a la US\n");
  process.stdout.write("    3. Implementá con test primero, después: dai check\n");
  process.stdout.write("    Guía paso a paso: docs/PROBAR.md\n\n");
}

// ── docs: documentación conceptual → <destino> ────────────────────────────────
function cmdDocs(dest) {
  if (!dest) fail("uso: dai docs <destino>");
  mkdirSync(dest, { recursive: true });
  cpSync(join(ROOT, "docs"), dest, { recursive: true });
  ok(`documentación copiada a ${dest}`);
}

// ── doctor: diagnóstico ───────────────────────────────────────────────────────
function cmdDoctor() {
  loadEnv();
  info(`dai doctor — versión v${readFileSync(join(ROOT, "VERSION"), "utf8").trim()}`);

  // Una skill sirve si está en el repo actual (.claude/skills, la puso `dai init`)
  // O global (~/.claude/skills, la puso `dai install`). Reportamos dónde.
  const localDir = join(process.cwd(), ".claude", "skills");
  info("skills (repo local / global ~/.claude/skills):");
  for (const name of readdirSync(join(ROOT, "skills"))) {
    const local = existsSync(join(localDir, name)), global = existsSync(join(SKILLS_DIR, name));
    if (local && global) ok(`${name}  (local + global)`);
    else if (local) ok(`${name}  (local, este repo)`);
    else if (global) ok(`${name}  (global)`);
    else warn(`${name} — no instalada (dai init en el repo, o dai install global)`);
  }

  info("adaptador de PM:");
  const pm = process.env.DAI_PM || "md";
  ok(`DAI_PM=${pm}`);
  if (pm === "jira") {
    if (!process.env.DAI_JIRA_BASE_URL) warn("falta DAI_JIRA_BASE_URL en el .env");
    if (!process.env.DAI_JIRA_EMAIL) warn("falta DAI_JIRA_EMAIL en el .env");
    if (!process.env.DAI_JIRA_TOKEN) warn("falta DAI_JIRA_TOKEN en el .env"); else ok("token de Jira presente");
    process.env.DAI_JIRA_PROJECT ? ok(`proyecto=${process.env.DAI_JIRA_PROJECT} (para dai publish)`)
      : warn("DAI_JIRA_PROJECT vacío — solo hace falta para `dai publish` (crear issues)");
  }
  if (pm === "clickup") {
    if (!process.env.DAI_CLICKUP_TOKEN) warn("falta DAI_CLICKUP_TOKEN en el .env"); else ok("token de ClickUp presente");
    process.env.DAI_CLICKUP_LIST_ID ? ok(`lista=${process.env.DAI_CLICKUP_LIST_ID} (para dai publish)`)
      : warn("DAI_CLICKUP_LIST_ID vacío — solo hace falta para `dai publish` (crear tareas)");
  }
}

// ── version ───────────────────────────────────────────────────────────────────
function cmdVersion() {
  process.stdout.write(`dai v${readFileSync(join(HERE, "..", "VERSION"), "utf8").trim()}\n`);
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
  case "publish": cmdPublish(pos[0]).catch((e) => fail(String(e.message))); break;
  case "pr":      cmdPr(opts).catch((e) => fail(String(e.message))); break;
  case "install": cmdInstall(opts).catch((e) => fail(String(e.message))); break;
  case "init":    cmdInit(pos[0], opts).catch((e) => fail(String(e.message))); break;
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
      "  link-us <KEY> [--us <md>]    crea branch + implements.yaml; sin --us trae la US del tracker (ADR-0004)\n" +
      "  link-us <KEY> --resync       re-estampa el ac_hash contra la US viva (tras un ⚠️ de check)\n" +
      "  check                        compara vs la US viva → atrasado (ADR-0003)\n" +
      "  stamp                        estampa la cobertura en el tracker (ADR-0005)\n" +
      "  pr [--assignee u] [--base b] [--draft] [--yes]   crea TU PR/MR precargada (muestra + confirma)\n" +
      "  forge comment <ref> --body-file <f> · forge pr <ref>   comentar/leer una PR ajena (github/gitlab)\n\n" +
      "Instalación:\n" +
      "  install [--global | --local <repo>] [--force] [--dry-run]   skills → Claude\n" +
      "  init [<repo>]                scaffolder interactivo del repo (asistente, gestor, OpenSpec)\n" +
      "       --for claude|copilot|both   para qué asistente preparar el repo (default both; ante duda, both)\n" +
      "       --pm md|jira|clickup · --openspec   (con flags salteás las preguntas)\n" +
      "  docs <destino>               documentación conceptual → <destino>\n" +
      "  doctor                       diagnóstico del entorno\n\n" +
      "  (config: .env — ver .env.example)\n"
    );
    process.exit(cmd && cmd !== "help" ? 1 : 0);
}
