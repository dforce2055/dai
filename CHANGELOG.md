# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Versionado semver
(ver `VERSION`).

## [0.15.0] — 2026-09-09

<!-- dai:manifiesto · el material de esta versión. Repartilo abajo y contá el porqué:
     dai sabe qué entró; por qué importa lo sabés vos.
     (sin US) feature/release-flow
-->

### Agregado

### Cambiado

### Corregido

### Interno

## [0.14.0] — 2026-09-08

**`dai pr` proponía mergear a `main` en un repo donde `main` despliega a producción, y el
preview no lo destacaba de ninguna forma. Tirando de ese hilo apareció que el problema no
era el default: era pedirle a alguien que configure "la base", cuando la base no es una
constante — es consecuencia del tipo de branch. Y de yapa, el hallazgo más caro de la
versión: `dai <comando> --help` no imprimía ayuda, ejecutaba el comando.**

### Cambiado
- **La base de una PR sale del mapa de ramas del repo, no de un `main` fijo.** Se declaran
  las **dos ramas de vida larga** en el `.env.dai` —`DAI_BRANCH_DEV` (la que integra) y
  `DAI_BRANCH_PROD` (la que despliega a producción)— y `dai pr` deriva la base del **tipo de
  branch**: `feature/` y `fix/` integran, `release/` y `hotfix/` van contra producción.
  `--base` gana siempre. Sin nada declarado, dai cae a la rama default del remoto
  (`origin/HEAD`) **y avisa que la está adivinando** — antes decía `main` sin más.
  `dai done` usa el mismo mapa (tenía el mismo `main` hardcodeado) y `dai doctor` lo reporta.
  El preview ahora dice **de dónde salió** la base, que era la mitad que faltaba
  ([#46](https://github.com/dforce2055/dai/issues/46)).
- **Apuntarle a producción pide confirmación explícita.** Si la base es `DAI_BRANCH_PROD`,
  el preview la marca `⚠️ DESPLIEGA A PRODUCCIÓN` y hay que **escribir el nombre de la rama**
  para seguir; con `--yes` hace falta `--to-prod`. Sin la variable declarada dai no marca
  ninguna rama como producción: no adivina cuál es, y un gate inventado sobre una suposición
  es peor que no tenerlo.
- **`dai <comando> --help` imprime ayuda en vez de ejecutar el comando.** Vale para todos:
  `dai help`, `dai --help`, `dai -h`, `dai help <cmd>`, `dai <cmd> --help`, `dai <cmd> -h` y
  `dai <cmd> help`. Siempre por `stdout` y siempre con código 0; un comando desconocido sigue
  saliendo por `stderr` con código ≠ 0, que es lo que deja `dai foo --help` usable dentro de
  un script. Cada comando tiene ayuda propia (qué hace, uso, opciones, ejemplo).

### Corregido
- **`dai pr` dejaba una MR con el diff al día y la descripción vieja.** Con una MR ya abierta
  pusheaba la branch, fallaba al crear porque la MR existía, y la única señal era el comando
  crudo del forge. Quedaba una MR que **miente sobre lo que contiene**, que es peor que un
  error porque parece que salió bien. Ahora la detecta **antes** de pushear
  (`gh pr list --head` / `glab mr list --source-branch`), el preview dice
  `── Pull Request a ACTUALIZAR (#12) ──` y actualiza título y descripción. Si la detección no
  pudo correr y el forge responde *"already exists"*, la busca y la actualiza igual; si tampoco
  puede, lo dice con todas las letras: *"NO toqué su descripción: quedó la vieja"*. También
  avisa si la MR abierta apunta a otra base que la pedida ([#46](https://github.com/dforce2055/dai/issues/46)).
- **`dai link-us` estampaba `version: v1` en una US que declaraba `v4`.** El regex del
  `spec_version` exigía separador y la US lo escribía pegado (`specversion`) — y estaba
  **duplicado en dos módulos**, que es exactamente por qué se podía arreglar en uno y seguir
  roto en el otro. Ahora vive en un solo lugar y tolera `spec_version`, `spec version`,
  `spec-version` y `specversion`. Sin `spec_version` declarado **no se inventa un `v1`**: queda
  `pendiente` con aviso, porque ese número se publica en el cuerpo de la PR y se estampa en el
  tracker como si fuera un dato. `dai check` además avisa cuando el número del link no coincide
  con el de la US viva ([#46](https://github.com/dforce2055/dai/issues/46)).
- **`dai pr` no podía abrir la PR de un repo sin US.** En un repo que no se trackea a sí mismo
  con User Stories —el de dai, sin ir más lejos— una branch `fix/` sin ID moría pidiendo un
  link que no puede existir, y aconsejaba renombrarla a `chore/`, que para un fix es el consejo
  equivocado. Ahora, si la branch no exige link **y** el repo no declara ninguna US, la PR sale
  "Sin US" con el motivo. Una `feature/` sin link sigue fallando: ahí falta de verdad.
- **`.env.dai` no estaba en el `.gitignore` de este repo**, aunque `dai init` lo agrega en todos
  los que scaffoldea. Faltaba justo en el que se publica en npm.

### Interno
- **408 tests** (+41): el mapa de ramas y la derivación por tipo de branch, la detección y
  actualización de una PR existente en los dos forges, las variantes del `spec_version`, y la
  convención de ayuda — con un test que recorre los `case` del dispatcher y **falla si alguno se
  agrega sin ayuda**, para que la convención no dependa de acordarse.

## [0.13.3] — 2026-09-02

**Una PR de dai se abría diciendo, en el mismo párrafo, dos cosas que no encajaban: que el
spec estaba "verificado con dai check: ✅ al día", y a continuación una explicación general
del método. Tirando de ese hilo aparecieron dos bugs distintos, y los dos eran dai afirmando
cosas que no le constaban.**

### Arreglado
- **El relleno del estado reescribía la prosa del template.** `dai pr` hacía un replace
  **global** de `verificado con `dai check` ✅`, y esa frase estaba dos veces en el molde: en
  el dato (`## 🔗 Implementa`) y en la prosa que explica el método. Así que a una oración
  general —igual en todas las PRs— dai le insertaba el estado de *esta* PR, y quedaba
  publicado: *"verificado con `dai check`: ✅ al día. Sin esto, el código no sabe a qué QUÉ
  responde…"*. Ni doctrina ni dato. Ahora el relleno se acota a la sección; sin la sección
  (un template ajeno con otra forma) cae al body entero, porque rellenar de más es
  recuperable y publicar `ABC-###` no.
- **`dai pr` decía "❓ sin US" cuando el tracker no contestaba** — dos líneas debajo del id de
  la US que sí existe. `coverageStatus` colapsaba en un mismo `sin-us` dos cosas que no
  significan lo mismo: *el tracker contestó y la US no está* y *no hubo respuesta* (sin red,
  sin token, 5xx, certificado corporativo). Los adaptadores ya distinguían los dos casos
  (`404 → null`, cualquier otro error → `throw`), y el gate de CI también con su try/catch
  propio; lo que rompía la distinción era un `.catch(() => null)` en `dai pr`. Hay un estado
  nuevo, **`sin-respuesta`** (`⚠️ no verificado`), y la PR dice *"no verificado (el tracker no
  respondió)"*, que es lo único cierto ([#43](https://github.com/dforce2055/dai/issues/43)).
- **`dai: fetch failed` era todo lo que se llegaba a leer.** Es el mensaje pelado de undici
  cuando no hay red, el host no resuelve o el certificado no valida: no dice qué se estaba
  consultando, ni contra qué, ni qué mirar — indistinguible de un bug de dai, el mismo modo de
  falla que el push por SSH de la 0.13.1. Ahora el error nombra la US, el backend y el host, y
  distingue red / credencial / error del tracker, con el próximo paso en cada caso.
- **`dai check` ya no se detenía en la primera US** que no pudiera consultar: lo reporta, sigue
  con las demás y sale ≠ 0. **`dai stamp`** explicita que no estampa un estado que no pudo
  verificar — escribir en el tracker de todo el equipo no se deshace.

### Cambiado
- **El molde de PR adelgaza: la doctrina pasa a comentario HTML.** El encabezado tenía cuatro
  bloques y un solo dato — la doctrina de los dos activos, una línea que repetía la de arriba
  (*"este PR está atado a la US vía implements.yaml"*) y la instrucción de borrar la sección si
  no hay US, que `dai pr` resuelve solo desde la 0.13.2. Nada de eso decía algo sobre *esa* PR,
  y repetirlo a la vista en cada una entrena a saltear el principio del cuerpo, que es
  justamente donde va la descripción. Sigue estando para quien edite el molde, invisible al
  renderizar; y la doctrina vive donde se lee una vez y no quinientas: `docs/glosario.md`,
  `docs/guias/dev.md`, `governance/ci-rules.md`. Los repos ya inicializados lo reciben con
  `dai sync`.

### Interno
- **367 tests** (+9): los dos caminos de la consulta (la US que no está y la que no se pudo
  consultar), el mensaje de error por tipo de falla, y que el relleno del estado no toque la
  prosa que lo rodea.

## [0.13.2] — 2026-09-02

**Una PR se publicaba con la descripción vacía y la lista de cambios diciendo "Cambio 1,
Cambio 2". No siempre: a veces salía perfecta. Lo raro es que "Enlaces relacionados", que
vive en el mismo template, nunca falló — y ahí estaba la pista. Y de yapa, el paquete de npm
adelgaza de 3.7 MB a 703 kB: cargaba las capturas del sitio.**

`dai pr` rellenaba cada sección **solo si tenía el dato** y, si no lo tenía, devolvía el
molde del template intacto, en silencio. La "Descripción" quedaba en su comentario HTML, que
no se renderiza: en GitHub y en GitLab la sección se ve **vacía**. El bloque de enlaces nunca
falló porque su código siempre escribe — si no encuentra la sección, la agrega. Esa
disciplina ahora vale para todo el cuerpo de la PR.

Detrás del bug había algo más de fondo: **no existía forma de escribir la descripción**.
`dai pr` no aceptaba ningún texto, así que el propósito de la PR solo podía salir del título
de la US y de los subjects de los commits. Ni el dev ni su agente podían hacerlo bien aunque
quisieran.

### Arreglado
- **La PR salía con el molde del template sin llenar.** Tres caminos llevaban al mismo
  resultado, los tres silenciosos: (1) el tracker no contestaba —sin token, sin red, `DAI_PM`
  mal seteado— y sin el título de la US no se llenaba "Descripción"; (2) la branch base no
  existía **en local** —clones `--single-branch`, repos donde se trabaja sobre `develop` y la
  base es `main`— y `git log base..HEAD` fallaba dentro de un `catch` vacío, dejando "Cambios
  realizados" con `Cambio 1 / Cambio 2`; (3) una branch exenta (`chore/`, `docs/`) nunca
  llenaba "Descripción", ni siquiera pudiendo. Ese mismo `catch` vacío también se comía el
  chequeo de *"sin commits sobre la base no hay PR"*.
- **La branch base ahora se resuelve** a `main` o, si no está en local, a `origin/main`.
- **Las secciones se reconocen aunque el repo tenga su propio molde** (`## 📝 Descripción del
  cambio`, `### CAMBIOS REALIZADOS`): antes el match era exacto, no encontraba la sección y
  devolvía el body sin tocar — otra vez, sin decir nada. Ignora los `##` que estén dentro de
  un bloque de código y, si la sección no existe, la agrega.

### Agregado
- **`dai pr --description "…"` y `--description-file <archivo.md>`** — el propósito de un
  cambio no se deriva de git ni del tracker. dai llena la US, el estado del check, los commits
  y los links; el porqué lo escribe quien crea la PR. **dai no lo inventa: lo pide.**
- **`--changes` y `--changes-file`** — reemplazan el detalle de "Cambios realizados" cuando los
  commits no cuentan bien la historia. Sin ellos, siguen saliendo de los commits de la branch.
- **La constitución que escriben `dai init` y `dai sync` lo dice**, para que el agente que
  corre `dai pr` sepa que la descripción es suya. Los repos ya inicializados la reciben con
  `dai sync`.

### Cambiado
- ⚠️ **`dai pr` no publica una PR que saldría con el molde sin llenar.** Con `--yes` o sin TTY
  —el camino de un agente o de CI— **aborta** y dice qué flag pasar; en terminal avisa y decide
  la persona. **Si tenés automatización con `dai pr --yes` sin `--description`, se va a frenar**:
  es justamente lo que publicaba las PRs vacías. El molde también se detecta en la cabecera
  (`ABC-###`), la misma familia de los issues #31/#33.

### Arreglado — el paquete de npm
- **`npm i -g @dforce2055/dai` bajaba las capturas del sitio.** `files[]` lista `docs`
  entero, y ahí adentro viven las de los tutoriales (`docs/public/tutoriales/*.png`): **2.9 MB
  de los 3.7 MB del paquete**, que el CLI no abre nunca. El test de higiene que ya cubría el
  sitio (`index.html`, `onboarding.html`) no las veía porque entraban por otra puerta.
  **3.7 MB → 703 kB**, 130 → 117 archivos, cero PNG en el tarball ([#37](https://github.com/dforce2055/dai/issues/37)).
- **`dai docs` copiaba imágenes que no se veían.** Los `.md` referencian las capturas con la
  ruta absoluta del sitio (`![…](/tutoriales/x.png)`, que VitePress resuelve contra
  `docs/public/`); fuera del sitio esa ruta apunta a la raíz del filesystem, así que en la
  copia **ya estaban rotas**, con los 2.9 MB adentro y todo. Ahora `dai docs` no copia
  `public/` —son assets del sitio, no documentación para leer desde un repo— y **absolutiza**
  esos links contra el sitio publicado: la doc copiada por fin muestra las capturas.

### Interno
- **358 tests** (+19). Uno por cada camino que dejaba pasar el molde del template —tracker
  caído, sin commits, branch sin US, template propio del repo, headings dentro de un fence, y
  el caso peor (sin tracker y sin commits a la vez)— más los de la reescritura de links y dos
  de higiene que fijan la regla del paquete: que `files[]` declare la exclusión, y que no
  aparezcan imágenes versionadas bajo `docs/` fuera de esa carpeta. Si mañana una captura
  aterriza en otro lado, el test obliga a decidir ahí, no midiendo el tarball.

## [0.13.1] — 2026-08-24

**Un dev en Windows no podía pushear contra el GitLab de su empresa. `ssh -T` le autenticaba
perfecto, `git push` moría con `Permission denied (publickey…)`. Dos días buscando el problema
en la clave, en el token y en los permisos del server: no estaba en ninguno de los tres, y dai
tapaba la única línea que lo decía.**

Su clave tenía passphrase. En Windows conviven dos `ssh.exe` — el de OpenSSH for Windows, que
habla con el servicio `ssh-agent`, y el que trae Git for Windows, que no lo ve. `ssh -T` usaba
el primero (la firma la hacía el agente, passphrase nunca), `git push` usaba el segundo y pedía
la passphrase por stderr. Ese prompt caía en un pipe de dai: el dev veía un cuelgue sin
explicación, ssh se rendía, caía a autenticación por password y lo único legible al final era
un error que acusa a la clave. Todo lo que hacía falta para resolverlo estaba en pantalla, y no
llegaba.

### Arreglado
- **`dai pr` se tragaba lo que git y ssh preguntan.** El push corría con `stderr` en `pipe`
  para no ensuciar la salida, pero git y ssh **preguntan por stderr**: la passphrase de una
  clave, la confirmación de un host nuevo, el aviso del credential manager. Con el prompt
  invisible el comando no se cuelga por un bug, se cuelga esperando una respuesta que nadie
  sabe que tiene que dar. Ahora `stderr` va heredado y el push pregunta a la vista. El error de
  git se lee en vivo, cuando todavía sirve, en vez de aparecer resumido después del fracaso.
- **La pista al fallar el push asumía que el remoto era HTTPS.** Decía siempre *"si es la
  primera vez contra este remoto, autenticá pusheando a mano una vez"*. Eso arregla HTTPS,
  donde el credential manager pide la credencial la primera vez. Contra un remoto **SSH** el
  push a mano falla exactamente igual — así que la pista mandaba a repetir un comando condenado
  y a seguir buscando en el lugar equivocado. Ahora el consejo depende del transporte: en SSH
  aclara que el token de `gh`/`glab` no interviene en el push, que lo que hay que mirar es la
  clave, y deriva a `dai doctor`.

### Agregado
- **`dai doctor` — sección `forge`.** Reporta el remoto `origin` con su forge detectado y, en
  Windows con remoto SSH, **qué `ssh.exe` va a usar git**: si es el suyo (el de Git for
  Windows, que no llega al `ssh-agent`), lo advierte, explica el modo de falla y da el fix
  (`git config --global core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"`). Respeta la
  precedencia real de git —`GIT_SSH_COMMAND` > `GIT_SSH` > `core.sshCommand`— y avisa cuando
  una variable de entorno está pisando un `core.sshCommand` que ya estaba bien: ese caso es
  particularmente cruel, porque el dev arregla el config, no funciona, y mirando el
  `.gitconfig` no hay nada que ver. Fuera de Windows, o con un remoto HTTPS, no opina.
  Núcleo puro y testeado en `cli/lib/git-ssh.mjs` (14 tests); en `dai.mjs` queda solo el I/O.

## [0.13.0] — 2026-08-21

**Un dev de backend en Windows siguió el tutorial al pie de la letra y el agente se puso a
programar sin escribir la propuesta. No era Windows ni era su setup: le estábamos diciendo mal
el nombre del comando.**

### Arreglado
- **Los comandos de OpenSpec se documentaban solo en la forma de Claude Code.** OpenSpec
  genera un archivo distinto por asistente, y el nombre del comando sale del archivo:
  `.claude/commands/opsx/<id>.md` → `/opsx:propose`, pero
  `.github/prompts/opsx-<id>.prompt.md` → `/opsx-propose` (Copilot) y
  `.cursor/commands/opsx-<id>.md` → `/opsx-propose` (Cursor). O sea: **solo Claude usa los
  dos puntos**, y el tutorial de setup del dev —que es el de Windows + Copilot— mostraba los
  dos puntos en los tres pasos.
  El síntoma no se parece en nada a la causa, y ahí está el daño: tipear `/opsx:propose` en
  Copilot **no da error**. No matchea ningún comando, el workflow nunca se carga, y el agente
  toma el texto suelto como una charla — se saltea el gate propose → aprobación → apply y
  arranca a implementar. Se lee como "el bot hace lo que quiere" y se le echa la culpa al
  asistente, al sistema operativo o al método. Es vibe coding servido por la documentación.
  Ahora `dai init` imprime la forma que le toca a **tu** asistente (`opsxHint`), el tutorial
  de Windows lo dice explícito con su propia entrada en *Cuando algo falla*, y la guía del
  dev aclara que la forma con dos puntos es la de Claude.
- **`dai check` terminaba con código de error en Windows aunque el chequeo pasara**
  (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`).
  Salía con `process.exit()` inmediatamente después del `fetch` al tracker, y en Windows eso
  aborta el proceso mientras undici todavía está desarmando sus handles. Imprimía
  `✅ al día` y devolvía distinto de cero igual: un gate verde reportado como rojo en CI o en
  un hook de git — justo el modo de falla que apaga un gate.
  Ahora el código de salida se fija con `process.exitCode` y el event loop drena solo. Cuesta
  ~40 ms (los sockets keep-alive de undici están *unref'd*) y no cambia nada en macOS/Linux.
  El mismo tratamiento va para los `.catch()` del dispatcher de **todos** los comandos que
  salen a la red o spawnean npm (`link-us`, `stamp`, `update-us`, `edit-us`, `forge`,
  `publish`, `pr`/`mr`, `install`, `init`), con `failSoft()`: ahí el comando ya terminó, así
  que cortar de una no aportaba nada y podía tapar el mensaje de error con un stack de C.
  Adentro de un comando `fail()` sigue saliendo de una — ahí sí hay que no volver.

### Agregado
- **Regla nueva en la constitución: *el diseño se aprueba antes de implementar*.** Al terminar
  la propuesta el agente para y pide aprobación explícita; si no tiene una herramienta para
  preguntar, pregunta en texto plano y espera. Vale para los tres asistentes. Es el borde
  QUÉ↔CÓMO, que sí es dominio de dai: sin esa firma, la implementación no tiene contra qué
  revisarse — y el gate no puede depender de que el asistente de turno tenga la herramienta
  correcta. Los repos ya inicializados la reciben con `dai sync`.
- **`dai doctor` avisa si OpenSpec está por debajo de 1.10.0.** Hasta esa versión, los prompts
  que OpenSpec generaba para Copilot y Cursor nombraban los comandos en la forma de Claude
  (`/opsx:apply`, que ahí no existe) e invocaban `AskUserQuestion`/`TodoWrite`, que solo tiene
  Claude Code. El agente terminaba nombrando comandos inexistentes y salteándose el gate de
  aprobación porque su única forma de preguntar no existía. Está arreglado upstream
  ([#727](https://github.com/Fission-AI/OpenSpec/issues/727),
  [#1307](https://github.com/Fission-AI/OpenSpec/issues/1307),
  [#1103](https://github.com/Fission-AI/OpenSpec/issues/1103)), pero un equipo que instaló
  antes se queda con la versión vieja y el síntoma no se parece a la causa.
- **`dai doctor` reporta los comandos de OpenSpec**, con la forma que le toca a **este** repo:
  `✓ Copilot: /opsx-explore · /opsx-propose · /opsx-apply · /opsx-archive`. Si no están
  generados, dice el comando exacto para generarlos —con el tool id que espera OpenSpec, que
  para Copilot es `github-copilot` y no `copilot`—. Solo mira los asistentes configurados en
  el repo: tener las skills instaladas globalmente no dice nada de los comandos, que son
  archivos versionados.

### Cambiado
- **`introduces` se cierra al TERMINAR de implementar, y lo normal es que lo escriba el
  agente.** El tutorial del dev pedía completarlo justo después de `dai link-us` — cuando
  todavía no se puede saber qué capacidades técnicas va a introducir el change; al empezar
  sería adivinar. Y la skill `link-us` decía explícito "dejar `introduces` para que el dev lo
  liste", cargándole a mano un dato que sabe mejor quien acaba de implementar.
  La frase "el único archivo que se autora **a mano**" empujaba el malentendido: lo que dice
  el ADR-0004 es que es el único registro **autorado** —se escribe, no se deriva—, y `link-us`
  ya resuelve `id`, `version`, `ac_hash`, `change`, `repo` y `autor` por construcción.
  Ahora lo dicen igual el archivo generado, la skill, su template, el tutorial (con el paso de
  cierre después de `/opsx-apply`), la guía del dev, el glosario y el ejemplo end-to-end. El
  **DoD suma el ítem**: `introduces` cerrado, sin el placeholder `<capacidad-tecnica>`.
- **El DoD nombra los comandos de OpenSpec sin atarlos a un asistente.** Decía
  `opsx:apply` → `opsx:archive`, la forma de Claude, en un template que viaja a los tres.
- **`DAI_JIRA_FIELDS_FILE` sale comentada en el `.env.dai` que genera `dai init`.** Apuntaba
  al mismo valor que ya usa el CLI por defecto, así que no aportaba nada — pero hacía creer
  que faltaba un archivo obligatorio, y un dev terminó pidiendo los `customfield_*` de la
  empresa para un archivo que **solo hace falta para crear** US, no para leerlas.

### Interno
- **325 tests** (+6 desde 0.12.0): `opsxCommand` y `opsxHint` —que solo Claude lleva los dos
  puntos, y la línea combinada de `dai init` cuando el repo configura varios asistentes—, el
  archivo y el tool id de OpenSpec por asistente (`github-copilot`, que no es `copilot`),
  `OPENSPEC_MIN`, que `DAI_JIRA_FIELDS_FILE` salga comentada, y que la regla nueva de la
  constitución llegue a los tres asistentes.

## [0.12.0] — 2026-08-13

**La PR deja de robarle la US a otro. `dai pr` resolvía el link recorriendo todo el repo y
quedándose con el último `implements.yaml`; ahora lo resuelve la rama, que es la que sabe la
respuesta — y cuando no puede saberlo, pregunta en vez de elegir en silencio. Más el tutorial
de setup del dev, la contraparte del que ya tenía el funcional.**

### Arreglado
- **`dai pr` armaba la PR con la US equivocada** (issues [#31](https://github.com/dforce2055/dai/issues/31),
  [#32](https://github.com/dforce2055/dai/issues/32), [#33](https://github.com/dforce2055/dai/issues/33)).
  Recorría **todos** los `implements.yaml` del repo —archivados incluidos, porque era el
  único comando que no pasaba `{ includeArchived: false }`— y el `break` cortaba solo el
  bucle interno, así que ganaba el **último** en orden de lectura. La rama, que la nombra el
  propio `dai link-us`, no entraba en la decisión.
  El síntoma es silencioso y por eso duele: la PR sale con el título, el link y el
  `dai check ✅` de **otra** US. En repos reales convivieron dos PRs con el mismo título y
  contenidos que no tenían nada que ver, y una PR de archivado apareció rotulada con la
  historia de un compañero. Es exactamente el modo de falla que la constitución quiere
  evitar — el link QUÉ↔CÓMO queda mal y nadie se entera, porque **nadie lee el
  `implements.yaml` en la lista de PRs: leen el título**.
  Ahora decide `prScope` (`cli/lib/branch-scope.mjs`), hermana de `stampScope`: la rama
  nombra una US viva → esa; una sola US viva → esa; varias candidatas → **pregunta** con TTY
  y **falla** sin TTY, listándolas.
- **Una rama exenta ya no hereda la US del repo.** Un `chore/`/`docs/`/`release/` que no
  nombra ninguna US genera la PR **sin** US —título del último commit y la sección
  *Implementa* diciendo que no hay historia— en lugar de colgarle la de otro o dejar el
  placeholder `ABC-###` del template.
- **`dai done` anunciaba `US cerrada:` con todas las US del repo**, archivadas incluidas.
  Cerrar una rama informaba el cierre de medio sprint. Mismo defecto de clase, en un mensaje.
- **Ctrl+D en las preguntas de `dai pr`** cancela en vez de cortar con `Aborted with Ctrl+D`.
  Todas ellas preceden a una acción hacia afuera (push + PR): ahí abortar es lo seguro.

### Agregado
- **`dai pr --us <ID>`** — el escape hatch explícito, y la única salida cuando hay ambigüedad
  y no hay TTY (un pipeline). Acepta también un change ya archivado.
- **El preview dice de dónde salió la US**: `US: ABC-482 — la branch '…' nombra ABC-482`.
  Cuando el título está mal, es lo único que lo delata.
- **[Tutorial de setup para desarrolladores (Windows)](docs/tutoriales/setup-dev.md)** — el
  otro lado del que ya existía para el funcional: Node, dai, git + SSH + `glab`, las skills
  en Copilot, OpenSpec, el `.env.dai` contra Jira, y el ciclo completo sobre una US real
  (`link-us` → `check` → `mr` → `stamp` → `done`). El troubleshooting sale de lo que pasó de
  verdad en Windows corporativo: el push HTTPS que necesita completar el credential manager,
  el proxy con su propio certificado, el gate de CI.

### Versionado

**Minor → 0.12.0.** `dai pr` **cambia de comportamiento**: donde antes elegía una US en
silencio, ahora pregunta (o falla), y una rama exenta genera la PR sin US. En el papel es
incompatible; en la práctica el comportamiento viejo era el bug de los issues #31/#32/#33.
Suma la flag `--us`, aditiva. El contrato del modelo (`ac_hash`, schema de `implements.yaml`)
queda intacto.

### Interno
- **319 tests** (+12 desde 0.11.0): `prScope` ×10 —la rama manda sobre el orden de
  directorio, los archivados no compiten, una `chore/` no hereda, la ambigüedad no se
  resuelve sola— y el cuerpo/título de una PR sin US ×2.
- `requiresLink()` devuelve además `kind` (`always` / `exempt` / `untyped`): es lo que separa
  "exenta por tipo" de "la rama no dice nada", y lo que `dai pr` necesitaba para no heredar
  la US de otro sin romper el gate de CI.

## [0.11.0] — 2026-07-22

**Ronda de fixes reportados usándola, más el eslabón que faltaba: editar el QUÉ. `dai stamp`
deja de estampar de más, el gate de governance pasa de regla escrita a comando ejecutable,
`dai edit-us` trae la US del tracker y valida el formato antes de devolverla, y los mensajes
de error dejan de mandar el diagnóstico para el lado equivocado.**

### Agregado
- **`dai check --ci`** — el gate de [`governance/ci-rules.md`](governance/ci-rules.md),
  ejecutable ([ADR-0018](docs/adr/0018-alcance-de-stamp-y-gate-de-ci.md), issue #26). El
  documento prometía "sin `implements.yaml` el CI bloquea" y no existía el comando que lo
  hiciera: era una regla escrita que nadie aplicaba. Ahora lee el nombre de la rama y
  aplica `branch-naming.md` — `feature/` siempre exige US, `chore/`/`docs/`/`ci/`/`release/`
  y compañía quedan **exentas**, `fix/` exige solo si el nombre trae un ID. Salidas:
  `0` pasa · `1` falta el link · `2` el QUÉ cambió. Detecta sola la rama en CI
  (`GITHUB_HEAD_REF` y equivalentes: en una PR, `HEAD` es un merge commit detached).
  Con `--no-network` valida el link sin pegarle al tracker.
- **`templates/ci-dai-gate.yml`** — workflow listo para copiar a `.github/workflows/`.
  Fuera de GitHub Actions el contrato es el mismo: un comando y su código de salida.
- **`dai edit-us <ID>` y `dai update-us <ID>`** — editar el QUÉ deja de ser copiar y pegar
  (issue #23, [ADR-0018](docs/adr/0018-alcance-de-stamp-y-gate-de-ci.md)). Dos puertas a un
  solo camino: `edit-us` **baja la US del tracker**, te la abre en tu `$EDITOR` y la sube
  (para el PO); `update-us` empuja un `.md` que ya escribiste (para el dev que refinó la US
  implementándola). Las dos dan el mismo preview y la misma confirmación, porque comparten
  el mismo tramo de escritura.
  - **Valida el formato antes de guardar** contra el molde canónico
    (`templates/formato-us.md`): frenan las tres cosas sin las cuales no hay `ac_hash`
    —sin título, sin sección de criterios, sección vacía— y **avisan** las demás (un
    criterio que no es Gherkin completo, uno que se mete en el CÓMO, un título
    kilométrico). `--strict` sube los avisos a errores.
  - **Un formato inválido no tira lo escrito**: te devuelve al editor con los errores a la
    vista, las veces que haga falta.
  - **Propone subir el `spec_version`** cuando el `ac_hash` se movió, y espera un sí o un
    no: `s` = cambio material (los repos con la versión vieja se marcan **atrasados**),
    `n` = cambio editorial (no se marca nadie). dai sabe *que* cambió, no *si importa* —
    eso lo sabe el PO. `--bump` / `--no-bump` para el modo no interactivo.
  - **Re-estampa el `ac_hash`** del `implements.yaml`, que si no `dai check` te marcaría
    atrasado por tu propia edición. `--dry-run` muestra todo el preview sin escribir.

### Arreglado
- **`dai stamp` estampaba TODAS las US del repo, archivadas incluidas** (issue #22). Cerrar
  una historia dejaba un comentario de cobertura en los tickets de las otras tres del
  sprint — y un comentario en un tracker no se deshace. Ahora el alcance sale de la rama
  ([ADR-0018](docs/adr/0018-alcance-de-stamp-y-gate-de-ci.md)): si la rama nombra la US,
  esa; si hay una sola viva, esa; si hay varias y no puede saber cuál, **pregunta** en vez
  de estampar de más (y sin TTY falla pidiendo el ID, en vez de decidir por vos). Los
  changes archivados salen del default. `dai stamp <ID>` es explícito y `dai stamp --all`
  recupera el comportamiento anterior.
- **El error del forge decía `¿token? ¿ref correcta?` para todo** (issue #24). Sin token,
  token vencido, token sin scope y PR inexistente caían en la misma frase, y eso costó una
  sesión entera de diagnóstico equivocado. Ahora se nombran por separado: **no hay
  `GITHUB_TOKEN`/`GITLAB_TOKEN`** (se detecta antes de salir a la red, y no se afirma que
  esté vencido algo que no existe) · **401** el token existe pero no sirve, con el `curl`
  para verificarlo · **403** válido pero sin permiso, o rate limit · **404** nombra las
  **dos** causas, porque en un repo privado GitHub devuelve 404 y no 403 a propósito. El
  diagnóstico ahora cubre `forge pr`, `forge comment` y `forge review`, que antes se
  tragaban el error real.
- **`.dai/reviews/` en el `.gitignore` de los repos ya inicializados** (issue #25). La
  regla estaba desde 0.10.0, pero solo la aplicaban `dai init`/`dai sync`, y el
  `review.json` lo escribe la skill: un repo scaffoldeado con una dai vieja se comía
  borradores a medio editar en un commit. Ahora `dai forge review` lo agrega al consumir
  un borrador que está bajo `.dai/reviews/`. Además la reconciliación compara **normalizado**
  (`.dai/reviews`, `/.dai/reviews/` y `.dai/reviews/` son la misma regla), así no duplica
  la línea a quien ya la había puesto a mano.
- Un `Ctrl+D` en un prompt de confirmación se trata como **cancelar** en vez de crashear
  con `Aborted with Ctrl+D`.

### Interno
- **`cli/test/package-hygiene.test.mjs`** — chequea lo que hasta ahora era un `git grep` a
  mano antes de pushear: que ningún fuente versionado tenga bytes NUL (uno se coló y git
  pasó a tratar el archivo como binario, con el diff dejando de ser revisable), que todo
  sea UTF-8 válido, que no viajen identificadores de repos de terceros —la convención de
  los ejemplos es ACME— y que `files[]` no publique el sitio.

### Versionado

**Minor → 0.11.0.** `dai stamp` sin argumentos **cambia de comportamiento**: antes estampaba
todas las US del repo, ahora una. En el papel es incompatible; en la práctica el
comportamiento viejo era el bug que reporta el issue #22, y quien lo quiera tiene `--all`.
El contrato del modelo (`ac_hash`, schema de `implements.yaml`) queda intacto, y todo lo
demás es aditivo.

### Cambiado
- `governance/ci-rules.md` describe lo que la máquina realmente hace: el comando que
  ejecuta cada regla, la tabla de ramas exentas, y por qué el gate no bloquea sin
  credenciales del tracker.
- **Los adaptadores de PM devuelven `raw`** (el markdown completo de la US) además del
  parseo. Es lo que `edit-us` abre; antes solo salían título + hash, que alcanza para
  detectar drift pero no para editar.
- **`/grill-user-story` distingue crear de refinar.** Si la US es nueva la crea como
  siempre (MCP o `dai publish`); si **ya tiene key**, ahora la actualiza con
  `dai edit-us <ID> --us <md> --no-editor` en vez de pisar el ticket por MCP. Así el
  camino de la skill pasa por los mismos controles que el manual: validación de formato
  antes de escribir, preview, y la pregunta del `spec_version` — que la skill tiene
  instrucción explícita de trasladarle al PO, no de responder con `--yes`.
- **Las skills dicen bien dónde está la config: `.env.dai` *o* `.env`.** Varias mandaban a
  leer solo uno de los dos, y quien tenía todo en el `.env` del equipo veía a la skill
  concluir que no había tracker configurado. dai **carga los dos** —`.env.dai` gana si una
  clave está en ambos, y un repo que nunca creó `.env.dai` sigue funcionando igual
  (ADR-0017)—; ahora las skills lo dicen así. Sin cambios de comportamiento en el CLI:
  el loader ya hacía esto.
- Documentación al día con los comandos nuevos: la [guía del PO](docs/guias/po.md) estrena
  una sección "Cuando el QUÉ cambia", más `docs/guias/dev.md`, `docs/PROBAR.md`,
  `docs/EJEMPLO-END-TO-END.md`, `docs/SCRUM-CON-IA.md`, `docs/METODOLOGIA.md`,
  `docs/glosario.md`, `docs/detalle/01-refinamiento.md` y `docs/detalle/07-merge-trazabilidad.md`.

## [0.10.0] — 2026-07-18

**La config de dai deja de vivir en el `.env` del equipo y pasa a un `.env.dai` propio (no
versionado). Resuelve el caso de las empresas que versionan el `.env` como política: dai no
toca ese archivo y guarda sus secretos donde git realmente los ignora. Y `dai init` estrena
una bienvenida con el Sol de Mayo en bloques.**

### Agregado
- **Banner de bienvenida en `dai init`**: el Sol de Mayo de dai en bloques (cuerpo y rayos
  rectos en oro, rayos ondulados en celeste) junto al título, más un preview de lo que se va
  a configurar. Cero dependencias (solo ANSI); degrada a ASCII sin color en no-TTY o con
  `NO_COLOR`.
- **`dai skills install --from npm:@scope/pkg`** — nueva fuente para skills externas
  ([ADR-0013](docs/adr/0013-skills-externas-install-from.md)): además de git URL y path
  local, ahora un **paquete npm**. dai hace `npm install` a un temp (respetando el `.npmrc`
  del repo, así resuelve **registries privados con scope**; `npm pack` no sirve con los
  registries de grupo de GitLab). Es común distribuir skills como paquete npm; antes había
  que materializarlo a mano.
- **Descripciones en bloque YAML (`|` / `>`) en el frontmatter de las skills.** El parser
  de frontmatter ahora lee bloques literales/plegados multilínea (antes tomaba solo la
  primera línea `|` y el validador lo rechazaba). Es como se escriben las skills reales:
  descripciones ricas con "USAR CUANDO / NO USAR CUANDO" que el agente usa para elegirlas.

### Cambiado
- **`dai init` escribe en `.env.dai` + `.env.dai.example`, no en `.env`/`.env.example`**
  ([ADR-0017](docs/adr/0017-env-dai.md)). El `.env` del equipo queda intacto (dai solo lo
  lee). `.env.dai` (secretos) se gitignorea; `.env.dai.example` (plantilla) se versiona.
  En un repo sin `.env`, dai ya no crea uno: es del equipo, no de dai.
- **El loader lee `.env.dai` y `.env`** con precedencia **shell/CI > `.env.dai` > `.env`**.
  Seguir leyendo `.env` mantiene la compatibilidad: los repos que ya tenían los `DAI_*` ahí
  no se rompen.
- **`.gitignore`**: dai ignora `.env.dai` (su archivo), no `.env`. Ya no fuerza un ignore
  sobre un archivo que muchas orgs versionan a propósito.
- Se renombró el `.env.example` del paquete a `.env.dai.example`, y se actualizaron doctor,
  mensajes de init/sync, tutoriales, constitución y README a la nueva convención.

### Interno
- **228 tests** (+4 desde 0.9.0): precedencia de `loadDaiEnv` (shell > `.env.dai` > `.env`),
  compat con `.env`, y sin-archivos. Smokes de `dai init` con y sin `.env` preexistente.

## [0.9.0] — 2026-07-17

**El review de dai deja de ser un comentario al final del hilo y pasa a ser un review
_inline_: un resumen más un comentario anclado a cada `archivo:línea`, clasificado
low/medium/high — como el de Copilot, pero con la puerta humana y la validación que a
Copilot le faltan.**

### Agregado
- **`dai forge review <ref> --from <review.json>`** — review inline en GitHub y GitLab.
  La skill `dai-review` produce un `review.json` (el criterio); el CLI hace lo mecánico
  (ADR-0002): **valida que cada `path:line` exista de verdad en el diff** —traído con git,
  local, por SSH— antes de salir a la red. Inventar líneas es el error más común de un
  LLM revisando código, y el forge responde `422` sin decir cuál falló; en GitHub, que es
  atómico, un hallazgo inventado tira los buenos. Lo descartado y lo filtrado **se
  reportan**, nunca se caen en silencio.
- **Puerta humana explícita.** Sin `--yes` no se postea nada: se muestra el preview y se
  corta. `--dry-run` valida sin postear. Modo desatendido para reviews simples
  (`--yes --min-severity --min-confidence --max-comments`), pero es una **excepción que
  el humano pide**, no un default. El review sale siempre con `event: COMMENT`, nunca
  `APPROVE` — dai comenta, la persona firma ([Art. 5](docs/MANIFIESTO.md#art-5)).
- **Aviso de release en Discord.** Publicar un release de GitHub dispara el workflow
  `discord-release.yml`, que postea al canal vía el secreto `DISCORD_WEBHOOK_URL`. El
  secreto vive en GitHub Actions, nunca en el repo; el workflow no viaja en el paquete
  npm (`.github/` fuera de `files`), así que no le impone notificaciones a nadie que use
  dai. Ver [ADR-0016](docs/adr/0016-review-inline.md).

### Cambiado
- **`getPR` expone `headSha`, `baseRef` y `diffRefs`** — hacían falta para anclar un
  comentario inline (GitHub necesita el sha del head; GitLab exige los tres shas de
  `diff_refs` en cada comentario). `dai init` agrega `.dai/reviews/` al `.gitignore` del
  repo (un review a medio editar no se commitea; `.dai/` sigue versionándose).

### Interno
- **224 tests** (+40): el parser de diff con varios hunks y archivos borrados, el
  descarte de líneas inventadas por lado, los filtros de severidad/confianza/tope, y la
  asimetría GitHub (atómico) vs. GitLab (no atómico: reporta los parciales en vez de
  fingir atomicidad). Probado end-to-end contra una PR real: el comentario quedó inline
  en el archivo, el review salió `COMMENTED`, y el hallazgo alucinado nunca tocó la red.

## [0.8.2] — 2026-07-17

**Dos agujeros que destapó el uso real, y que tienen la misma forma: dai hacía algo
hacia afuera sin que un humano lo viera, o dejaba que otro le pisara lo que había
escrito. El [Art. 5](docs/MANIFIESTO.md#art-5) no se cumple solo con no clickear
Approve.**

### Arreglado
- **`dai-review` posteaba el comentario sin mostrártelo.** La skill componía el review y
  lo publicaba de una: el paso 6 decía *"Postear"* y no había gate. Y el comentario sale
  con **tu token y tu nombre** (`GITHUB_TOKEN`/`GITLAB_TOKEN` son tuyos), así que en la
  PR de un compañero figura como si lo hubieras escrito vos. El corte estaba puesto en el
  lugar equivocado: no aprobar sin humano estaba bien, pero publicar un juicio sobre el
  código de otro, firmado por alguien que no lo leyó, es el mismo problema con otro
  disfraz. Ahora la skill **muestra el comentario entero y espera un OK explícito** en
  ese turno; sin "sí", no se postea. Es el tercer corte duro de la skill.
- **`dai pr` escribía el id de la US disfrazado de link.** Sin `DAI_TRACKER_URL_TEMPLATE`,
  `trackerUrl(id)` devolvía el **id pelado**; como un string es truthy, `composePrBody` lo
  escribía igual y la PR quedaba con `- US: 86abc123` en vez de un enlace, sin un solo
  aviso. Ahora la URL se resuelve por una cadena explícita —template > URL canónica del
  tracker > derivada del backend > `null`— y **si dai no la sabe, avisa y omite la línea
  en vez de mentir** (`lib/tracker-url.mjs`).
- **El bloque de enlaces de `dai pr` no sobrevivía a un edit.** Iba marcado con un
  comentario suelto, así que cualquier agente que reescribiera *"Enlaces relacionados"*
  se lo llevaba puesto sin dejar rastro — pasó en PRs reales. Y el propio template lo
  invitaba: su hint pedía *"US en el tracker, commit ancla, docs, issues"*, o sea justo la
  sección que `dai pr` acababa de llenar. dai se peleaba consigo mismo y ganaba el que
  corría último. Ahora el bloque va **delimitado** (`<!-- dai:links:start … end -->`),
  se **regenera de forma idempotente**, preserva lo que el humano sumó abajo, y el hint
  del template pide solo lo que dai **no** sabe (docs, issues, PRs relacionadas).

### Cambiado
- **dai deduce el link al tracker solo.** Con `DAI_PM=jira` o `=clickup` ya no hace falta
  `DAI_TRACKER_URL_TEMPLATE`: se deriva de la config (`/browse/<KEY>` y
  `/t/<id>`), y `fetchUS` ahora devuelve la **URL canónica** del tracker — en ClickUp, la
  que trae el `team_id`, que no se puede deducir del id. La variable queda como
  **override** para trackers con URL propia. `dai init` dejó de scaffoldearla: era
  contraproducente, porque el template gana sobre la canónica y le tapaba el `team_id`.
  Los `.env` que ya la tienen siguen andando igual (el override sigue ganando).

## [0.8.1] — 2026-07-16

**Primera prueba real en Windows con analistas y devs de una empresa: el ciclo completo
contra un Jira corporativo anduvo, y de paso destapó lo que faltaba pulir para que un
equipo Windows + Copilot + GitLab no se topara con muros.**

### Arreglado
- **`dai sync` crasheaba en repos Copilot** con `ReferenceError: skillToPrompt is not
  defined`. El pase a Agent Skills nativas (0.8.0, [ADR-0014](docs/adr/0014-copilot-agent-skills.md))
  borró `skillToPrompt` y migró `dai init` a `.github/skills/`, pero dejó dos llamadas
  colgadas en el path viejo `.github/prompts/`: `dai sync` y `dai skills install --from`
  (rama Copilot). Ahora ambos copian la skill nativa (`.github/skills/<name>`, con
  `templates/`) igual que `init`, y `sync` **migra** el repo: limpia los `.prompt.md`
  viejos de dai. `dai sync` también detecta Copilot por `.github/skills` (antes solo por
  `.github/prompts`, así que ni veía los repos nuevos). Cubierto por un test de
  integración de `dai sync --for copilot` — el hueco que dejó pasar la regresión.
- **`dai upgrade` (y `dai init --openspec`) fallaban en Windows** con un genérico *"no
  pude consultar el registry (¿sin red?)"* aunque npm anduviera perfecto. En Windows `npm`
  y `openspec` son shims `.cmd`, y desde Node 18.20 / 20.12 / 21.7 (fix de CVE-2024-27980)
  `execFileSync` **se niega a lanzar un `.cmd` sin `shell:true`** — tira `EINVAL`, que dai
  confundía con falta de red. Ahora esos binarios se corren con `shell` en Windows.
- **`dai pr` fallaba el push la primera vez contra un remoto HTTPS corporativo.** El push
  corría con stdin ignorado, así que Git Credential Manager no podía pedir la credencial y
  el push moría en seco — mientras el error real de git quedaba oculto tras un genérico
  *"Command failed"*. Ahora el push hereda stdin (con `GIT_TERMINAL_PROMPT=1`) para que el
  login se pueda completar, **muestra el stderr real de git**, y si aún falla sugiere
  pushear a mano una vez para cachear la credencial.

### Agregado
- **`dai mr` como alias de `dai pr`.** En un shop de GitLab uno tipea "mr" (merge request);
  ahora funciona. Es el mismo comando (detecta el forge y usa `gh`/`glab`), solo más natural.

### Cambiado
- **El diagnóstico de un 400 de `dai publish` ahora coincide con lo que Jira dijo.** Antes
  mandaba SIEMPRE a declarar un campo propio (`customfield_NNNNN` en `.dai/jira-fields.json`),
  aunque el 400 fuera *"Por favor indicar épica…"* — confuso, porque el fix real es
  `--parent`. Ahora la ayuda se elige según el cuerpo del error: regla de épica padre →
  `--parent`, campo obligatorio → `jira-fields.json`, genérico → nombra las dos causas sin
  empujar una sola.
- **`dai pr` explica por qué no pudo crear la PR/MR** en vez de un *"¿instalado y
  autenticado?"*. Si `gh`/`glab` no está instalado (`ENOENT`) lo dice y enlaza la
  instalación + `… auth login` (con `--hostname` para GitLab self-hosted); si falla por
  otra cosa, **imprime el stderr real del forge** (auth vencida, host sin configurar, flag
  desconocido). Era el caso ciego del equipo con GitLab corporativo.
- **El diagnóstico de TLS ofrece primero el camino más simple**: `NODE_OPTIONS=--use-system-ca`
  (Node ≥ 22.15), que usa el trust store del sistema donde el navegador ya confía en la CA
  de la empresa — validado contra el proxy real. `NODE_EXTRA_CA_CERTS` queda como
  alternativa para cualquier versión de Node. (Sigue prohibido `NODE_TLS_REJECT_UNAUTHORIZED=0`.)

### Docs
- **El prerequisito de `dai pr`: `gh`/`glab` instalado y autenticado.** Un callout en la
  sección del dev con el setup one-time del CLI del forge (`gh auth login` /
  `glab auth login --hostname <tu-gitlab>`, con la nota del PATH en Windows tras instalar con
  winget). Era el paso que faltaba documentar — sin el CLI, `dai pr` pushea igual y avisa.
- **README consistente con Copilot nativo.** La tabla de superficies ya decía que Copilot
  carga skills en app / CLI / IDE / cloud (solo el chat de github.com queda afuera), pero el
  resto del README seguía en el modelo viejo: la tabla de `--for`, el árbol del repo y el
  snippet de `dai skills install` hablaban de `.github/prompts/*.prompt.md` y de que "Copilot
  no tiene skills instalables". Corregido a `.github/skills/` nativo — validado con un dev
  corriendo dai en la app de GitHub Copilot desktop.

### Interno
- **161 tests** (+3): integración de `dai sync --for copilot` (regresión + migración del
  layout viejo).
- **Conocido, sin arreglar:** en Windows, tras un `dai publish` con red, puede aparecer al
  salir `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c` — un
  crash de *teardown* de libuv, posterior a toda la salida útil (cosmético). Se investiga.

## [0.8.0] — 2026-07-15

**El primer analista funcional real usó dai contra un Jira corporativo, y encontró el
hueco entre "anda en mi Jira de juguete" y "anda en el de una empresa".**

### Agregado
- **Campos propios de Jira**, declarados por issuetype en `.dai/jira-fields.json` (o
  `DAI_JIRA_FIELDS_FILE`) con nombre humano, forma, default y opciones válidas. dai valida
  **antes** de llamar a la red: un typo da `'Mejraa' no es opción de 'clasificacion' —
  válidas: Mejora | Corrección`, no un 400 críptico. El valor se elige por US con
  `dai publish us.md --field clasificacion=Corrección` (repetible), porque la clasificación
  cambia según la historia y un default fijo publicaría todas iguales ([ADR-0015](docs/adr/0015-jira-corporativo.md)).
- `dai publish --parent <KEY>` — cuelga la US de su épica (antes `createUS` nunca mandaba
  `parent`, así que las US quedaban sueltas).
- `dai publish --issuetype <T>` — **`grill-epic` gana su fallback por CLI**: hasta ahora, sin
  MCP, una épica quedaba en un `.md` para pegar a mano.
- **Diagnóstico de TLS**: un fallo de certificado ahora enseña `NODE_EXTRA_CA_CERTS` (el caso
  típico es el proxy corporativo: Node no usa el trust store del sistema) y explica por qué
  `NODE_TLS_REJECT_UNAUTHORIZED=0` no es una alternativa — apaga la verificación entera y por
  ahí viaja tu token.
- **Constitución**: dos reglas nuevas para todos los asistentes — no bajar la seguridad para
  avanzar, y parar y avisar si el CLI no llega en vez de improvisar la llamada por fuera.

### Cambiado
- **Copilot lee `SKILL.md` nativo** ([ADR-0014](docs/adr/0014-copilot-agent-skills.md)).
  `dai init --for copilot` genera `.github/skills/` (copia cruda, **con los `templates/`**) en
  vez de `.github/prompts/*.prompt.md`, y borra los prompts viejos de dai para que no dupliquen
  cada `/comando`. Los prompt files propios del equipo no se tocan.
- **`dai skills install --for copilot` ya existe** → `~/.copilot/skills/`. Antes warneaba
  *"Copilot no tiene skills instalables"*: era cierto hasta que GitHub adoptó Agent Skills, y
  por eso una skill "instalada global" no le aparecía a nadie que usara la app o el CLI de
  Copilot (`~/.claude/skills` solo lo mira VS Code).
- **`dai doctor` reporta solo los asistentes que el repo usa.** Antes listaba los tres siempre:
  quien configuraba uno veía 14 warnings de los otros dos y leía "está todo roto". Ahora
  también chequea Copilot, valida `DAI_JIRA_PROJECT` y que el archivo de campos parsee.
- **Un flag repetido acumula** (`--field a=1 --field b=2`) en vez de que gane el último en
  silencio.

### Arreglado
- **`doc-to-backlog` y `grill-epic` no cargaban en Copilot.** Sus descripciones tenían un `: `
  suelto (*"…épicas finales: extrae…"*), que un parser YAML lee como el arranque de un mapa y
  descarta la skill entera — justo las dos que más necesita un analista funcional. El defecto
  siempre estuvo en la fuente: lo tapaban nuestro `parseFrontmatter` (que es un regex, no YAML)
  y la conversión a `.prompt.md` (que citaba el valor al serializarlo). Ahora las 7
  descripciones van citadas, **`validateSkill` valida que `name` y `description` sean escalares
  YAML válidos**, y el molde de `templates/skill.md` cita por defecto.
- `DAI_JIRA_PROJECT=PROJ-42` (la clave de un **ticket**, el error de config más común) daba
  un 400 de Jira que no lo explicaba. Ahora falla **antes de la red**, con los dos caminos:
  `DAI_JIRA_PROJECT=PROJ`, o `--parent PROJ-42` si querías colgarla de esa épica.

### Quitado
- `skillToPrompt()` y el adaptador `.github/prompts/` de Copilot. Cuando el formato de una
  skill es un estándar abierto, el mejor adaptador es ninguno.

### Interno
- **158 tests** (+39 desde 0.7.0): `jira-fields` ×19, `http`/TLS ×7, contrato YAML del
  frontmatter ×7, `assertProjectKey` y el payload de `createUS` ×6.
- **Primera verificación en Windows.** Hasta ahora dai no se había instalado nunca en Windows
  (no hay CI de esa plataforma): se probó el ciclo completo — install, `dai init --for copilot`,
  skills globales en `~/.copilot/skills`, y Copilot cargando las 7. Los campos propios de Jira
  y el diagnóstico de TLS están cubiertos por tests contra un Jira simulado, **todavía no
  contra un Jira corporativo real**.
- `lib/jira-fields.mjs` y `lib/http.mjs` nuevos, cero dependencias (como el resto del CLI).

## [0.7.0] — 2026-07-14

**dai es el distribuidor de skills de cualquier stack, sin opinar sobre su contenido.**

### Agregado
- `dai skills install` — namespace de skills (`dai install` queda como alias). Con
  `--from <git-url|path>[#ref]` instala **skills externas** por-stack (.NET, Java,
  Rust…) desde un repo git (público o privado por SSH) o un path local, convertidas
  para los 3 asistentes (Claude/Cursor/Copilot).
  Self-service, one-off, sin registro; `dai sync` no las toca ([ADR-0013](docs/adr/0013-skills-externas-install-from.md)).
  Valida el contrato mínimo (`SKILL.md` con `name` + `description`) y saltea con aviso
  las malformadas; molde en [`templates/skill.md`](templates/skill.md). No valida el contenido.

## [0.6.0] — 2026-07-12

Self-update del CLI y blindaje de autoría del repo.

### Agregado
- `dai upgrade` (alias `update`): actualiza el CLI global a la última publicada
  (`npm i -g …@latest`), con `--check` y `--dry-run`. No toca el repo: reporta el
  drift del scaffold pero deja el `dai sync` explícito del mantenedor (ADR-0012).

### Interno
- Guard de autoría: rechaza commits autorados/co-autorados por agentes de IA
  (check de CI `authorship` + hook local + `governance/human-authorship.md`).
- Eliminado `.mailmap` (ya no cumplía función).
- **111 tests** (+1: `planUpgrade`).

## [0.5.0] — 2026-07-10

**`archive` en el flujo** ([ADR-0011](docs/adr/0011-archive-gate-de-aprobacion.md)): cerrar el CÓMO
del lado de las specs canónicas, atado a la aprobación de la PR.

### Agregado
- **`dai archive [<change>]`**: funde los delta specs del change en las specs canónicas
  (`openspec/specs/`) y lo archiva. Lo corre el **aprobador** de la PR, en la branch, al aprobar
  (el fold viaja en la PR → elude la base protegida). Detecta el change activo por su `implements.yaml`
  o le pasás el nombre; envuelve `openspec archive --yes` (mecánico → comando, no skill). Flag `--skip-specs`.

### Cambiado
- **`dai check` y `dai ls` saltean `openspec/changes/archive/`**: un change shippeado ya no genera
  ⚠️ de drift falso ni aparece en el listado. `discoverImplements` acepta `includeArchived` (default
  `true`); `check`/`ls` lo pasan `false`. `stamp`/`done` mantienen el default (lo necesitan post-merge).

### Interno
- **110 tests** (+1 desde 0.4.0: filtro `includeArchived`).

## [0.4.0] — 2026-07-10

**Versionado y upgrade** ([ADR-0010](docs/adr/0010-versionado-y-upgrade.md)): mantené tu repo al
día con el CLI sin pisar nada. Las copias scaffoldeadas (skills, constitución, templates) son un
caché derivable — ahora la máquina te avisa cuando quedaron atrás y las refresca sola.

### Agregado
- **`dai sync`**: refresca skills, constitución, templates y PR template a la versión del CLI —
  **aditivo** (conserva tu `CLAUDE.md` propio vía bloque delimitado), sin tocar el `.env` ni OpenSpec.
  Detecta los asistentes del repo o acepta `--for`; `--dry-run` muestra qué cambiaría.
- **`dai doctor` · version-drift**: compara `.dai/VERSION` (scaffold del repo) vs el CLI y avisa con
  color + `⬆️` (misma major → refresh opcional con `dai sync`; major distinta → revisar migración;
  repo más nuevo → actualizar el CLI).
- **`dai version`**: además de la versión, muestra el estado de drift si estás en un repo con dai
  (chequeo liviano). `dai --version` fuera de un repo dai queda limpio (solo la versión).
- **`lib/semver.mjs`** (comparación de versiones, cero dependencias).

### Interno
- **Golden vectors de `ac_hash`**: pineados como inmutables dentro de la línea major — blindan el
  contrato ([ADR-0001](docs/adr/0001-contrato-ac-hash.md)) que hace seguros a los minors/patches y a `dai sync`.
- **109 tests** (+4 desde 0.3.1: semver ×3, golden vectors ×1).

> Diferido a un futuro major (ya diseñado en el ADR-0010): `dai migrate` + `MIGRATION.md` y estampar
> `schema:` en el `implements.yaml`.

## [0.3.1] — 2026-07-10

Pulido de la experiencia de `dai init` y `dai link-us`, y un ejemplo de US listo para probar.

### Corregido
- **`dai init` · `.env.example`**: ahora refleja el `--pm` elegido — incluye todas las claves del
  tracker (con el `..._TOKEN`), en vez del template genérico `md`. Antes, al elegir jira/clickup,
  el `.env.example` quedaba con `DAI_PM=md` y sin el token.
- **`dai init` · `--for` con espacio**: mensaje claro cuando `--for claude, cursor` (con espacio) hace
  que la shell parta la lista y un token de asistente caiga como `<repo>` ("no existe el directorio: cursor").
- **`dai link-us` · `dai ac-hash`**: mensaje accionable cuando la US no tiene sección
  'Criterios de aceptación' — sugiere agregarla o correr `/grill-user-story <ID>`.

### Agregado
- **`templates/formato-us.md`**: ejemplo de US copy-paste al final (con criterios testeables) para
  probar el flujo en 30 segundos, con o sin tracker (`dai ac-hash` / `dai link-us --us … --dry-run`).

### Interno
- **105 tests** (+1 desde 0.3.0: `isAssistantToken`).

## [0.3.0] — 2026-07-08

`dai init` ahora es **aditivo**: no pisa la configuración de un repo funcional. Más
robustez en el parser de `.env` y en `doctor`, y nuevas buenas prácticas agnósticas en
la constitución.

### Cambiado
- **`dai init` es aditivo y no destructivo** sobre un repo con config existente:
  - `.env` / `.env.example`: mergea solo las claves de dai que faltan (no reescribe lo del proyecto).
  - `CLAUDE.md` / `copilot-instructions.md`: inserta la constitución como bloque delimitado
    (`<!-- dai:start/end -->`), idempotente — conserva la constitución previa del proyecto.
  - `.gitignore`: reconcilia para versionar skills y comandos (`.claude/skills/`, `.claude/commands/`),
    dejando fuera solo lo personal (`settings.local.json`); quita ignores "broad" (`.claude/`, `CLAUDE.md`)
    que los escondían.
- **Constitución**: nuevas reglas agnósticas (verificar el comportamiento ≠ que compile, la IA confirma
  antes de construir, docs vivas) + sección "Buenas prácticas (agnósticas)". Tono "tú" neutro.

### Corregido
- **Parser de `.env`** (`env.mjs`): recorta el comentario inline en valores sin comillas — un token con
  `# ...` al lado ya no rompe el header `Authorization` (error de ByteString).
- **`dai doctor`**: enumera solo directorios; ya no lista `.DS_Store` como skill.

### Interno
- **104 tests** (+11 desde 0.2.0: `mergeEnv`, `upsertBlock`, `reconcileGitignore`, parser de `env.mjs`).
- El sitio (`index.html`, `onboarding.html`) sale del paquete npm (`files[]`) — es capa visual del repo/web.
- Nueva página de onboarding del dev (`onboarding.html`) en el sitio de GitHub Pages.

## [0.2.0] — 2026-07-08

Soporte para **Cursor** como asistente y un `--for` combinable. Incluye la **primera
contribución de la comunidad** 🎉 (@sermati).

### Agregado
- **Adaptador de Cursor** ([ADR-0009](docs/adr/0009-adaptador-cursor.md), aporte de la
  comunidad): `dai init` / `install` / `doctor` soportan Cursor — generan
  `.cursor/skills/*/SKILL.md` y `.cursor/rules/dai-constitution.mdc` (regla always-on) desde
  la misma fuente `skills/*/SKILL.md`.
- **`--for` combinable**: acepta subconjuntos de asistentes (`--for claude,cursor`,
  `--for copilot`), además de `both` (Claude+Copilot) y `all` (los tres). Nuevo
  `parseAssistants()` en `args.mjs`.

### Cambiado
- **Default de `dai init` = `all`** (Claude + Copilot + Cursor) — deja el repo listo para
  cualquier asistente.
- El mensaje de "próximos pasos" de `dai init` apunta a la **URL online** de la guía
  `PROBAR.md` (antes una ruta local que el usuario instalado no encontraba).

### Interno
- **93 tests** (+6 desde 0.1.1: `skillToCursor`, `constitutionCursorRule`, `parseAssistants`).

## [0.1.1] — 2026-07-06

Solo documentación y metadata — **el CLI no cambia** (mismo `ac_hash`, mismo protocolo).

### Cambiado
- `homepage` del paquete → el sitio de GitHub Pages (`dforce2055.github.io/dai`).
- Badge de npm activado en el README (tras el primer publish).
- Conteo de tests corregido en `RELEASING.md` (48 → 87).

## [0.1.0] — 2026-07-06

Primera versión: metodología completa + CLI de trazabilidad, probado end-to-end contra
ClickUp y Jira Cloud.

### Metodología
- Manifiesto (constitución: 4 valores + 15 artículos), METODOLOGIA (protocolo invariante
  + dial de niveles N1/N2/N3), SCRUM-CON-IA (los 10 pasos, con `detalle/`), EJEMPLO
  end-to-end, glosario, guías por rol (PO/dev/lead), landing autocontenido (`index.html`).
- 7 ADRs: `ac_hash`, agnóstico del asistente, detección/estampado como comandos,
  ubicación+schema del `implements.yaml`, superficie de comandos, distribución+licencia,
  modelo de autenticación.

### Templates y governance
- `formato-us`, `epica`, `definition-of-ready`, `definition-of-done`, `adr`,
  `pull-request`, hook `commit-msg`; `branch-naming`, `ci-rules`, `commit-convention`.

### Skills (para Claude y Copilot, generadas por `dai init`)
- El QUÉ: `doc-to-backlog` (un doc → backlog candidato), `grill-intent` (Gate 0),
  `grill-epic` (épicas), `grill-user-story` (la US — detecta el tracker del `.env` y publica).
- El CÓMO: `link-us`, `tdd`, `dai-review`.

### CLI (`dai`, Node, cero dependencias)
- **Definir el QUÉ:** `publish` (crea la US en el tracker desde un `.md`).
- **Trazabilidad:** `link-us` (+ `--resync`), `check`, `stamp`, `ls`, `ac-hash`.
- **PR y cierre:** `pr` (crea la PR precargada), `forge` (comentar/leer PR en GitHub/GitLab),
  `done` (cierra la US: vuelve a la base, actualiza y borra la branch).
- **Setup:** `init` (scaffolder interactivo: asistente + tracker + OpenSpec), `install`,
  `docs`, `doctor`.
- Adaptador de tracker: `md`, `jira` (ADF, Jira Cloud), `clickup`. Auth por SSH (git) +
  token scopeado (forge/tracker), nunca contraseñas.
- **87 tests** (`node --test`), cero dependencias de runtime.

### Distribución y comunidad
- Licencia **GPLv3**. Publicable en npm (scopeado); `install.sh` como shim de git-clone.
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `.editorconfig`, `.nvmrc`,
  `.gitattributes`, templates de PR/issue, CI de GitHub Actions (Node 18/20/22).
- Tests de las rutas de red (jira/clickup/forge) con `fetch` mockeado. Sin links rotos;
  `files` de npm sin tests ni secretos.

[0.15.0]: https://github.com/dforce2055/dai/releases/tag/v0.15.0
[0.14.0]: https://github.com/dforce2055/dai/releases/tag/v0.14.0
[0.13.3]: https://github.com/dforce2055/dai/releases/tag/v0.13.3
[0.13.2]: https://github.com/dforce2055/dai/releases/tag/v0.13.2
[0.13.1]: https://github.com/dforce2055/dai/releases/tag/v0.13.1
[0.13.0]: https://github.com/dforce2055/dai/releases/tag/v0.13.0
[0.12.0]: https://github.com/dforce2055/dai/releases/tag/v0.12.0
[0.11.0]: https://github.com/dforce2055/dai/releases/tag/v0.11.0
[0.10.0]: https://github.com/dforce2055/dai/releases/tag/v0.10.0
[0.9.0]: https://github.com/dforce2055/dai/releases/tag/v0.9.0
[0.8.2]: https://github.com/dforce2055/dai/releases/tag/v0.8.2
[0.8.1]: https://github.com/dforce2055/dai/releases/tag/v0.8.1
[0.8.0]: https://github.com/dforce2055/dai/releases/tag/v0.8.0
[0.7.0]: https://github.com/dforce2055/dai/releases/tag/v0.7.0
[0.6.0]: https://github.com/dforce2055/dai/releases/tag/v0.6.0
[0.5.0]: https://github.com/dforce2055/dai/releases/tag/v0.5.0
[0.4.0]: https://github.com/dforce2055/dai/releases/tag/v0.4.0
[0.3.1]: https://github.com/dforce2055/dai/releases/tag/v0.3.1
[0.3.0]: https://github.com/dforce2055/dai/releases/tag/v0.3.0
[0.2.0]: https://github.com/dforce2055/dai/releases/tag/v0.2.0
[0.1.1]: https://github.com/dforce2055/dai/releases/tag/v0.1.1
[0.1.0]: https://github.com/dforce2055/dai/releases/tag/v0.1.0
