// dai · la ayuda del CLI, y la CONVENCIÓN de cómo se pide.
//
// El bug que originó este archivo: `dai <comando> --help` no imprimía ayuda — el flag caía
// en `opts` y el comando SE EJECUTABA igual. Con comandos que hablan hacia afuera eso no es
// una molestia: `dai stamp --help` dejaba un comentario en el tracker, `dai pr --help`
// publicaba una branch y abría una PR. Los agentes lo pisan seguido, porque probar
// `<cmd> --help` antes de usar un comando es exactamente lo que hay que hacer.
//
// La convención, para que valga en TODOS los comandos y no haya que recordar cuál la
// implementa: pedir ayuda NUNCA ejecuta nada, siempre sale por stdout y siempre con 0.
//   dai help · dai --help · dai -h
//   dai help <comando> · dai <comando> --help · dai <comando> -h · dai <comando> help

// Tokens que significan "quiero la ayuda", en cualquier posición razonable.
// `-h` entra como POSICIONAL (el parser solo entiende `--`), por eso está en la lista.
export const HELP_TOKENS = new Set(["help", "-h", "-help", "--help", "ayuda", "?"]);

export const isHelpToken = (t) => HELP_TOKENS.has(String(t ?? "").toLowerCase());

// ¿Esta invocación pide ayuda en vez de ejecutar?
export function wantsHelp({ opts = {}, pos = [] } = {}) {
  if ("help" in opts || "h" in opts) return true;
  return pos.some(isHelpToken);
}

// Alias → comando canónico (para que `dai mr --help` no quede sin ayuda).
export const HELP_ALIAS = {
  mr: "pr", update: "upgrade", install: "skills", "skills-install": "skills",
  "link": "link-us", "us": "link-us",
};

// El tema del que se pide ayuda: el comando, o el primer positivo que no sea un token
// de ayuda (`dai help pr`). Devuelve null para la ayuda global.
export function helpTopic(cmd, pos = []) {
  const c = String(cmd ?? "").toLowerCase();
  if (c && !isHelpToken(c)) return HELP_ALIAS[c] || c;
  const t = pos.map((p) => String(p).toLowerCase()).find((p) => !isHelpToken(p));
  return t ? (HELP_ALIAS[t] || t) : null;
}

// ── Ayuda por comando ────────────────────────────────────────────────────────
// Cada entrada es autocontenida: qué hace, cómo se invoca, sus flags y un ejemplo real.
export const COMMAND_HELP = {
  "ac-hash": `dai ac-hash — calcula el ac_hash de una US (ADR-0001)

Uso:
  dai ac-hash <us.md>

Qué hace:
  Extrae la sección "Criterios de aceptación", la normaliza y devuelve su SHA-256 truncado
  a 8 hex. Es el mismo número que estampa \`dai link-us\` y compara \`dai check\`: si el QUÉ
  cambia, cambia el hash, y los CÓMO que lo implementaban quedan marcados como atrasados.

Ejemplo:
  dai ac-hash .dai/us/ABC-482.md
`,

  ls: `dai ls — lista lo que este repo implementa (ADR-0005)

Uso:
  dai ls [--json] [--root <dir>]

Qué hace:
  Recorre los implements.yaml del repo y muestra cada US linkeada con su versión, su
  ac_hash y el change de OpenSpec al que pertenece. Con --json sale la misma info
  estructurada, para scripts y CI.

Ejemplo:
  dai ls --json | jq '.[].id'
`,

  "link-us": `dai link-us — crea la branch + el implements.yaml (el link QUÉ↔CÓMO, ADR-0004)

Uso:
  dai link-us <KEY> [--us <us.md>] [--title <t>] [--change <c>] [--repo <r>] [--base <rama>]
  dai link-us <KEY> --resync
  dai link-us <KEY> --dry-run

Qué hace:
  Trae la US del tracker (o la lee del .md que le pases), calcula el ac_hash, crea la
  branch con el nombre canónico (governance/branch-naming.md) y escribe el implements.yaml.
  El KEY nunca se tipea a mano en la branch: sale del argumento.

Opciones:
  --us <us.md>     fuente local en vez del tracker (útil sin red/token)
  --resync         re-estampa el ac_hash contra la US viva, sin crear branch (tras un ⚠ de check)
  --title <t>      pisa el título (y por lo tanto el slug de la branch)
  --change <c>     nombre del change de OpenSpec (default: el slug del título)
  --base <rama>    de qué rama sale la branch nueva (default: donde estás parado)
  --dry-run        muestra branch + yaml y no toca nada

Notas:
  Si la US no declara \`spec_version\`, el link queda con \`version: pendiente\` y dai avisa:
  un \`v1\` inventado se publica en la PR y se estampa en el tracker como si fuera un dato.

Ejemplo:
  dai link-us ABC-482
  dai link-us ABC-482 --resync
`,

  check: `dai check — ¿tu implementación sigue cubriendo el QUÉ? (ADR-0003)

Uso:
  dai check
  dai check --ci [--branch <rama>] [--no-network]

Qué hace:
  Compara el ac_hash estampado en cada implements.yaml contra la US viva del tracker.
  Al día = el QUÉ no se movió. Atrasado = alguien cambió los criterios y tu CÓMO todavía
  no los cubre.

Modo --ci (gate de governance/ci-rules.md):
  Exige el link según el nombre de la branch — chore/, docs/, ci/, release/ y hotfix/
  están exentas. Salidas:  0 pasa · 1 falta el link · 2 el QUÉ cambió.
  --branch <rama>   la branch a evaluar (en CI se detecta sola)
  --no-network      valida solo que el link exista (sin consultar al tracker)

Ejemplo:
  dai check
  dai check --ci --branch feature/ABC-482-checkout
`,

  stamp: `dai stamp — estampa la cobertura en el tracker (ADR-0005, ADR-0018)

Uso:
  dai stamp [<ID>…] [--all] [--dry-run]

Qué hace:
  Deja en la US un comentario con qué repo/change/branch/commit la implementa y en qué
  estado quedó. Sin ID estampa la US de ESTA branch; si hay varias candidatas pregunta,
  porque un comentario en el tracker no se deshace.

Opciones:
  --all        estampa todas las US del repo (úsalo a sabiendas)
  --dry-run    muestra qué estamparía y no escribe nada

Ejemplo:
  dai stamp --dry-run
`,

  "update-us": `dai update-us — empuja al tracker un .md que ya escribiste

Uso:
  dai update-us <ID> [--us <us.md>] [--dry-run] [--yes] [--strict] [--no-resync] [--no-bump]

Qué hace:
  Valida el formato de la US, muestra el diff contra lo que hay en el tracker, propone
  subir el spec_version si cambiaron los criterios, publica y re-estampa el ac_hash local.

Opciones:
  --yes         no pregunta (sin --yes muestra el diff y pide confirmación)
  --strict      las advertencias de formato también frenan
  --no-resync   no re-estampa el ac_hash en el implements.yaml
  --no-bump     no toca el spec_version

Ejemplo:
  dai update-us ABC-482 --us borrador.md --dry-run
`,

  "edit-us": `dai edit-us — editar el QUÉ con red de seguridad (para el PO)

Uso:
  dai edit-us <ID> [--no-editor] [--bump | --no-bump] [--yes]

Qué hace:
  Trae la US del tracker, la abre en tu $EDITOR, valida el formato al guardar, te muestra
  qué cambia y recién entonces la escribe. Pregunta si el cambio es material para subir
  el spec_version — esa decisión es de la persona, no de dai.

Opciones:
  --no-editor          no abre $EDITOR (para skills/scripts que ya escribieron el .md)
  --bump / --no-bump   decide el spec_version sin preguntar (sin TTY no se toca y avisa)

Ejemplo:
  dai edit-us ABC-482
`,

  publish: `dai publish — crea la US en el tracker y devuelve su key

Uso:
  dai publish <us.md> [--parent <KEY>] [--issuetype <T>] [--field alias=valor]…

Qué hace:
  Valida el formato y crea el issue/tarea en el backend configurado (DAI_PM). Devuelve el
  key para que \`dai link-us\` lo use.

Opciones:
  --parent <KEY>       la cuelga de su épica
  --issuetype <T>      tipo de issue (p. ej. Epic; default DAI_JIRA_ISSUETYPE o Story)
  --field alias=valor  campos propios que exige tu Jira (.dai/jira-fields.json); repetible

Ejemplo:
  dai publish us.md --parent ABC-100 --field clasificacion=Evolutiva
`,

  pr: `dai pr — crea (o ACTUALIZA) TU Pull/Merge Request precargada

Uso:
  dai pr [--base <rama>] [--us <ID>] [--title <t>] [--assignee <u>] [--draft] [--yes]
  dai pr --description <texto> | --description-file <archivo>
  dai pr --changes <texto>     | --changes-file <archivo>
  dai mr …                     alias para GitLab (merge request)

Qué hace:
  Resuelve la US de esta branch, corre la verificación de trazabilidad, arma el body desde
  el template del repo, TE MUESTRA el preview y pide confirmación. Si la branch ya tiene
  una PR/MR abierta, la ACTUALIZA (título + descripción) en vez de fallar a mitad de camino.

La branch base sale del TIPO de branch, no de un default fijo:
  feature/ · fix/ · el resto  →  DAI_BRANCH_DEV   (la rama que integra)
  release/ · hotfix/          →  DAI_BRANCH_PROD  (la que despliega a producción)
  --base gana siempre; sin nada declarado cae a la rama default de origin, avisando.
  El preview dice de dónde salió la base. Contra DAI_BRANCH_PROD pide confirmación
  explícita — hay que escribir el nombre de la rama, y con --yes agregar --to-prod.

Opciones:
  --base <rama>          contra qué rama va la PR
  --to-prod              confirma que la base es producción (obligatorio junto a --yes)
  --us <ID>              con qué US titularla, si la branch toca varias
  --title <t>            pisa el título
  --description[-file]   QUÉ resuelve la PR y por qué → sección "Descripción"
  --changes[-file]       detalle de "Cambios realizados" (default: los commits)
  --assignee <u>         asigna la PR · --draft: la crea en borrador
  --yes                  no pregunta (igual frena si el body saldría con el molde vacío)

Ejemplo:
  dai pr --base develop --description-file notas.md
`,

  release: `dai release — el ciclo de versión: qué entra, cortarla, cerrarla, contarla

Uso:
  dai release plan [--from <ref>] [--to <rama>] [--json] [--no-network]

Qué hace:
  \`plan\` arma el MANIFIESTO de la próxima versión: qué hay entre el último tag y la rama de
  integración, qué User Stories entran y en qué estado, qué branches entraron sin US, y qué
  bump PROPONE — propone, no decide: dai lee los tipos de commit y la regla del repo mira el
  comportamiento. Un cambio que mueve un default es minor aunque todo sea \`fix:\`.

Opciones:
  --from <ref>    desde dónde contar (default: el último tag, ordenado por semver)
  --to <rama>     hasta dónde (default: DAI_BRANCH_DEV, o la branch actual)
  --json          el manifiesto estructurado, para scripts y para la skill
  --no-network    no consulta el tracker: sale igual, avisando que no pudo verificar

Ejemplo:
  dai release plan
  dai release plan --from v0.14.0 --json
`,

  done: `dai done — cierra la US: vuelve a la base, actualiza y borra la branch local

Uso:
  dai done [--base <rama>] [--force]

Qué hace:
  Verifica que no queden cambios sueltos ni commits sin pushear, vuelve a la base, hace
  fetch + pull --ff-only y borra la branch local SOLO si ya está mergeada.
  La base se resuelve igual que en \`dai pr\`: del tipo de branch (DAI_BRANCH_DEV /
  DAI_BRANCH_PROD), o de la rama default de origin si el repo no las declaró.

Opciones:
  --force    borra la branch aunque no esté mergeada

Ejemplo:
  dai done --base develop
`,

  archive: `dai archive — funde los delta specs y archiva el change (ADR-0011)

Uso:
  dai archive [<change>] [--skip-specs]

Qué hace:
  Mueve el change de OpenSpec a archive/ y funde sus delta specs en las specs canónicas.
  Lo corre QUIEN APRUEBA la PR, no quien la abre: es el gate de aprobación.

Ejemplo:
  dai archive checkout-sin-duplicado
`,

  forge: `dai forge — hablarle a una PR/MR AJENA (github/gitlab)

Uso:
  dai forge pr <ref>                          lee la PR/MR
  dai forge comment <ref> --body-file <f>     comenta en el hilo
  dai forge review <ref> --from <review.json> [--dry-run | --yes]

Qué hace:
  \`review\` postea un review INLINE: un comentario de resumen más uno anclado a cada
  archivo:línea. Sin --yes no postea nada: muestra el preview y valida que cada hallazgo
  apunte de verdad al diff (descarta las líneas que el modelo inventó).

Opciones de review:
  --min-severity low|medium|high · --min-confidence 0..1 · --max-comments N · --base <rama>

Auth:
  GITHUB_TOKEN / GITLAB_TOKEN en el .env.dai (token scopeado; git sigue usando SSH).

Ejemplo:
  dai forge review 42 --from review.json --dry-run
`,

  skills: `dai skills install — instala las skills de dai (alias: dai install)

Uso:
  dai skills install [--global | --local <repo>] [--force] [--dry-run] [--for <asistentes>]
  dai skills install --from <git-url|npm:pkg|path>[#ref] [--for <asistentes>]

Qué hace:
  Copia las skills al asistente (Claude, Copilot, Cursor). Con --from instala skills
  EXTERNAS por-stack, convertidas para los tres asistentes (ADR-0013).

Opciones:
  --for <asistentes>   claude|copilot|cursor (combinables con coma) · both|all (default all)
  --global             al home del asistente · --local <repo>: dentro de un repo
  --force              pisa lo que haya · --dry-run: muestra y no escribe

Ejemplo:
  dai skills install --global --for claude,cursor
`,

  init: `dai init — scaffolder del repo (asistente, gestor, OpenSpec)

Uso:
  dai init [<repo>] [--for <asistentes>] [--pm md|jira|clickup] [--openspec]

Qué hace:
  Interroga y deja el repo listo: skills del asistente, constitución, templates,
  .env.dai.example, gitignore y el gate de CI. Con flags te saltea las preguntas.

Opciones:
  --for <asistentes>   claude|copilot|cursor (combinables con coma) · both|all (default all)
  --pm <backend>       backend del tracker · --openspec: además scaffoldea OpenSpec

Ejemplo:
  dai init --for claude,copilot --pm jira --openspec
`,

  sync: `dai sync — refresca el scaffolding a la versión del CLI (ADR-0010)

Uso:
  dai sync [<repo>] [--dry-run] [--for <asistentes>]

Qué hace:
  Actualiza skills, constitución y templates a los de esta versión de dai. Es ADITIVO:
  no toca el .env.dai ni tus archivos de OpenSpec.

Ejemplo:
  dai sync --dry-run
`,

  upgrade: `dai upgrade — actualiza el CLI global (alias: dai update, ADR-0012)

Uso:
  dai upgrade [--check] [--dry-run]

Qué hace:
  Instala la última versión publicada (npm i -g …@latest) y avisa si el scaffolding del
  repo quedó atrasado respecto del CLI.

Opciones:
  --check      solo dice si hay una versión nueva
  --dry-run    muestra el comando y no lo corre

Ejemplo:
  dai upgrade --check
`,

  docs: `dai docs — copia la documentación conceptual a un destino

Uso:
  dai docs <destino>

Ejemplo:
  dai docs ./docs/metodologia
`,

  doctor: `dai doctor — diagnóstico del entorno

Uso:
  dai doctor

Qué hace:
  Revisa skills instaladas por asistente, constitución, comandos de OpenSpec, el backend
  de PM configurado, el remoto/forge y el cliente ssh, y avisa si el scaffolding del repo
  quedó atrasado respecto del CLI.
`,

  version: `dai version — versión del CLI (alias: --version, -v)

Uso:
  dai version

Además avisa si el scaffolding de este repo quedó atrasado respecto del CLI (ADR-0010).
`,

  help: `dai help — ayuda del CLI

Uso:
  dai help              todos los comandos
  dai help <comando>    el detalle de uno
  dai <comando> --help  lo mismo (también -h, o \`dai <comando> help\`)

Pedir ayuda NUNCA ejecuta el comando: sale por stdout y termina con 0.
`,
};

// ── Ayuda global ─────────────────────────────────────────────────────────────
export function globalUsage() {
  return (
    "Uso: dai <comando> [args]\n\n" +
    "Trazabilidad:\n" +
    "  ac-hash <us.md>              calcula el ac_hash (ADR-0001)\n" +
    "  ls [--json]                  lista lo que implementa el repo (ADR-0005)\n" +
    "  publish <us.md>              crea la US en el tracker (Jira/ClickUp/md) y devuelve el key\n" +
    "      [--parent KEY]           la cuelga de su épica · [--issuetype T] p. ej. Epic\n" +
    "      [--field alias=valor]    campos propios que exige tu Jira (.dai/jira-fields.json); repetible\n" +
    "  link-us <KEY> [--us <md>]    crea branch + implements.yaml; sin --us trae la US del tracker (ADR-0004)\n" +
    "  link-us <KEY> --resync       re-estampa el ac_hash contra la US viva (tras un ⚠️ de check)\n" +
    "  edit-us <KEY>                trae la US del tracker, la abrís en tu editor, valida el formato,\n" +
    "                               muestra qué cambia y la guarda (para el PO)\n" +
    "      [--no-editor]            no abre $EDITOR (para skills/scripts que ya escribieron el .md)\n" +
    "      [--bump | --no-bump]     decide el spec_version sin preguntar (sin TTY no se toca y avisa)\n" +
    "  update-us <KEY> [--us <md>]  empuja al tracker un .md que ya escribiste + re-estampa el ac_hash\n" +
    "      [--dry-run] [--yes]      sin --yes muestra el diff y pide confirmación · [--no-resync]\n" +
    "      [--strict]               las advertencias de formato también frenan · [--no-bump] no toca spec_version\n" +
    "  check                        compara vs la US viva → atrasado (ADR-0003)\n" +
    "  check --ci                   gate de CI: exige el link según branch-naming (chore/ y docs/ exentas)\n" +
    "      [--branch b]             la branch a evaluar (en CI se detecta sola) · [--no-network]\n" +
    "                               salidas: 0 pasa · 1 falta el link · 2 el QUÉ cambió\n" +
    "  stamp [<ID>…] [--all]        estampa la cobertura en el tracker (ADR-0005)\n" +
    "                               sin ID: la US de esta branch; si hay varias, pregunta\n" +
    "  done [--base b] [--force]    cierra la US: vuelve a la base, actualiza y borra la branch local\n" +
    "  release plan [--from r] [--to b] [--json]   el manifiesto de la próxima versión: qué US entran,\n" +
    "                               qué entró sin US, y qué bump propone (propone: firmás vos)\n" +
    "  archive [<change>] [--skip-specs]   funde los delta specs del change en las specs canónicas y lo archiva (lo corre el aprobador en la PR)\n" +
    "  pr (alias mr) [--assignee u] [--base b] [--draft] [--yes]   crea o ACTUALIZA TU PR/MR precargada (muestra + confirma)\n" +
    "      [--us <ID>] [--title t]  la US la resuelve la branch; si hay varias, pregunta (sin TTY, falla)\n" +
    "      --description <texto>    QUÉ resuelve la PR y por qué → sección 'Descripción' (o --description-file <f>)\n" +
    "      --changes <texto>        detalle de 'Cambios realizados' (default: los commits) (o --changes-file <f>)\n" +
    "      [--to-prod]              confirma una PR contra la rama de producción (DAI_BRANCH_PROD)\n" +
    "                               sin descripción y sin commits, con --yes o sin TTY, dai NO publica: la PR\n" +
    "                               saldría con el molde del template y no se podría revisar\n" +
    "  forge comment <ref> --body-file <f> · forge pr <ref>   comentar/leer una PR ajena (github/gitlab)\n" +
    "  forge review <ref> --from <review.json> [--dry-run|--yes]  review inline: resumen + comentario por línea\n" +
    "      --min-severity low|medium|high · --min-confidence 0..1 · --max-comments N · --base <branch>\n" +
    "      Sin --yes no postea nada: muestra el preview y valida que cada hallazgo apunte al diff.\n\n" +
    "Instalación:\n" +
    "  skills install [--global | --local <repo>] [--force] [--dry-run] [--for <asistentes>]   instala las skills de dai (alias: `install`)\n" +
    "  skills install --from <git-url|npm:pkg|path>[#ref] [--for <asistentes>]   instala skills EXTERNAS (por-stack), convertidas para los 3 asistentes (ADR-0013)\n" +
    "  init [<repo>]                scaffolder interactivo del repo (asistente, gestor, OpenSpec)\n" +
    "       --for <asistentes>      claude|copilot|cursor (combinables con coma) · o both|all (default all)\n" +
    "                               ej: --for claude,cursor · --for copilot · --for all\n" +
    "       --pm md|jira|clickup · --openspec   (con flags salteas las preguntas)\n" +
    "  sync [<repo>] [--dry-run] [--for <asistentes>]   refresca skills/constitución/templates a la versión del CLI (aditivo; no toca .env.dai ni OpenSpec)\n" +
    "  upgrade [--check] [--dry-run]   (alias: update) actualiza el CLI global a la última (npm i -g …@latest) y avisa si el repo quedó atrasado (ADR-0012)\n" +
    "  docs <destino>               documentación conceptual → <destino>\n" +
    "  doctor                       diagnóstico del entorno\n" +
    "  help [<comando>]             el detalle de un comando (también: dai <comando> --help)\n\n" +
    "  (config: .env.dai — ver .env.dai.example)\n"
  );
}

// El texto a imprimir para un tema. null/desconocido → la ayuda global.
export function helpFor(topic) {
  if (!topic) return { text: globalUsage(), known: true };
  const key = HELP_ALIAS[topic] || topic;
  const text = COMMAND_HELP[key];
  return text ? { text, known: true } : { text: globalUsage(), known: false };
}
