# Setup para desarrolladores (Windows)

Guía paso a paso para dejar tu entorno listo y **tomar una User Story de Jira, implementarla
y abrir la Merge Request en GitLab** con las skills de `dai` desde **GitHub Copilot**, con la
trazabilidad QUÉ↔CÓMO armada desde el primer commit.

Es el otro lado del [setup del funcional](./setup-funcional.md): ahí la US **nace**, aquí se
**implementa**. Tú no discutes el QUÉ; lo tomas ya definido y eres dueño del CÓMO.

> **¿Qué son las skills?** Son los comandos que ejecuta el **agente** en el chat de Copilot:
> `/link-us` (abre el CÓMO atado a la US, sin que tipees el key a mano), `/tdd` (test primero)
> y `/dai-review` (review inline de la MR de un compañero). El CLI `dai` es lo mecánico:
> `dai check`, `dai mr`, `dai stamp`. Más abajo está la tabla de qué va dónde.

**Atajo:** si tu proyecto **ya tiene dai** (existe la carpeta `.dai\`), lo único que te falta
es tu `.env.dai` con tus credenciales → salta al [**Paso 6**](#paso-6-conecta-jira).

Los ejemplos usan `acme.atlassian.net`, el proyecto `PROJ`, un GitLab en `gitlab.acme.com` y
un repositorio `tienda`: reemplázalos por los de tu empresa.

---

## Lo que vas a tener al terminar

```
  Jira PROJ-125         →   /link-us     →   feature/PROJ-125-…      →   dai mr
  (la US que ya existe)     (rama +          + implements.yaml           (MR precargada
                            el link)         + tu código                  con la US)
```

Y un `dai check` que te avisa **solo** si el PO cambió los criterios mientras implementabas.

---

## Paso 1 — Instala Node

Descarga el instalador **LTS** desde 👉 **https://nodejs.org** y ejecútalo.
Siguiente → Siguiente → Instalar.

Para comprobar que quedó, abre **PowerShell** (tecla Windows → escribe `powershell` → Enter):

```powershell
node --version
```

Tiene que responder algo como `v20.11.0`. Cualquier número **18 o mayor** sirve.

> **Si dice que no reconoce el comando:** cierra PowerShell, ábrelo de nuevo y reintenta. El
> instalador no refresca las ventanas que ya estaban abiertas.

---

## Paso 2 — Instala dai

```powershell
npm i -g @dforce2055/dai
dai --version
```

`dai --help` te lista todos los comandos. Para actualizarlo más adelante: `dai upgrade`.

---

## Paso 3 — Prepárate para trabajar con el repositorio

Tres cosas, una sola vez por máquina. Si ya trabajas con este repositorio, probablemente las
tengas:

| Qué | Para qué | Tutorial |
|---|---|---|
| **git configurado** (nombre + correo) | que los commits te atribuyan a ti, y que `dai link-us` sepa quién autora el link | [Configurar git](./configurar-git.md) |
| **Clave SSH** en GitLab | que `dai mr` pueda subir la rama sin pedirte credenciales | [Claves SSH](./claves-ssh.md) |
| **`glab`** instalado y autenticado | que `dai mr` **cree** la MR, no solo suba la rama | [Instalar gh / glab](./instalar-glab.md) |

En GitLab corporativo, el `--hostname` es obligatorio al autenticar:

```powershell
glab auth login --hostname gitlab.acme.com
```

> **Si tu equipo clona por HTTPS** en vez de SSH (habitual en Windows corporativo), no pasa
> nada: `dai mr` te deja completar el login del *Git Credential Manager* la primera vez que
> sube la rama. Hazlo con la ventana a la vista, porque ahí te lo pide.

---

## Paso 4 — Instala las skills en Copilot

**Este es el comando que te habilita los `/comandos`:**

```powershell
dai skills install --for copilot --global
```

Comprueba que llegaron:

```powershell
dir $env:USERPROFILE\.copilot\skills
```

Tienes que ver 7 carpetas: `dai-review`, `doc-to-backlog`, `grill-epic`, `grill-intent`,
`grill-user-story`, `link-us`, `tdd`. Las tuyas son **`link-us`**, **`tdd`**, **`dai-review`** y
**`grill-intent`**; las tres `grill-*` restantes son del funcional, y no molestan.

Reinicia Copilot (cierra y abre la sesión) y escribe `/` en el chat, en modo **Agent**. Tienen
que aparecer marcadas **`User Data`** — esa etiqueta confirma que salen de tu usuario.

> **Si no aparecen:** ejecuta `/skills` dentro de Copilot para refrescar el listado. Si sigue
> sin verlas, recarga la ventana: `Ctrl+Shift+P` → **Developer: Reload Window**.

> **¿Por qué `--global`?** Porque te sirven en **cualquier repositorio**, sin preparar nada. El
> repositorio igual va a tener su propia copia versionada (Paso 5), que es la que ve todo el
> equipo — y esa gana si difieren ([ADR-0014](../adr/0014-copilot-agent-skills.md)).

---

## Paso 5 — Inicializa dai en tu proyecto

Párate en el repositorio en el que vas a trabajar — el que ya tienes clonado — y comprueba si
dai ya está instalado ahí:

```powershell
cd $HOME\proyectos\tienda
dir .dai
```

> **Si la carpeta `.dai\` ya existe**, tu proyecto ya tiene dai: **no ejecutes `dai init`**, el
> scaffold es del equipo y está versionado. Lo único que te falta es tu configuración personal
> → salta al [Paso 6](#paso-6-conecta-jira).

Si no existe, inicializa dai en el repositorio:

```powershell
dai init --for copilot --pm jira
```

Te va a preguntar si quieres instalar **OpenSpec**: responde **`s`**. Es el motor del CÓMO —
convierte la US en `design.md` + `tasks.md` con los comandos `/opsx:*`. Un dev sí lo usa.

Lo que deja:

```
✓ .dai/         moldes (templates) + reglas (governance) del método
✓ .env.dai.example  creado (plantilla versionada)
✓ .env.dai      creado (no versionado), DAI_PM=jira (completa el token)
✓ .gitignore    ajustado (skills/constitución versionadas; .env.dai y settings.local.json fuera)
✓ .github/      pull_request_template.md — molde de PR atado al link
✓ Copilot:      .github/skills/ (7) + copilot-instructions.md
```

Todo eso se **commitea** —menos el `.env.dai`, que ya quedó ignorado— en una rama `chore/`, y
va por MR como cualquier otro cambio: es el scaffold que va a usar todo el equipo.

> **Si OpenSpec falló** (proxy, permisos de npm), súmalo después:
> ```powershell
> npm i -g @fission-ai/openspec@latest
> openspec init --tools github-copilot
> ```

> **Si algún comando te avisa que el scaffold quedó viejo** respecto de tu CLI, se actualiza
> con `dai sync` y se commitea. No lo hagas en medio de una historia: es un cambio del equipo,
> no tuyo.

---

## Paso 6 — Conecta Jira {#paso-6-conecta-jira}

El `.env.dai` es **tuyo**, lleva tus credenciales y **no se versiona**
([ADR-0017](../adr/0017-env-dai.md)). Es lo único que edita cada dev: el resto del scaffold es
del equipo.

Necesitas un **token de API de Atlassian**: si no tienes, sigue 👉 [Cómo obtener el token de
API de Jira](./token-jira.md) y vuelve con el token copiado.

Si el proyecto ya tenía dai, el archivo todavía no existe en tu copia — créalo desde la
plantilla versionada:

```powershell
copy .env.dai.example .env.dai
```

(Si lo acabas de crear con `dai init`, ya está: solo hay que completarlo.)

Abre el repositorio en el editor y completa el `.env.dai`:

```powershell
code .
```

```bash
DAI_PM=jira
DAI_JIRA_BASE_URL=https://acme.atlassian.net
DAI_JIRA_EMAIL=tu.correo@acme.com
DAI_JIRA_TOKEN=el-token-que-copiaste
DAI_JIRA_PROJECT=PROJ
DAI_JIRA_ISSUETYPE=Story
DAI_JIRA_FIELDS_FILE=.dai/jira-fields.json

# Solo si vas a usar /dai-review sobre la MR de un compañero (token con scope `api`):
GITLAB_TOKEN=
```

Guarda con `Ctrl+S`.

| Variable | Qué va | El error típico |
|---|---|---|
| `DAI_JIRA_PROJECT` | La clave del **proyecto**: las letras antes del guion. Si tus tickets son `PROJ-123`, va **`PROJ`**. | Pegar la clave de un **ticket**. dai te lo dice y te da el comando correcto. |
| `GITLAB_TOKEN` | Un *Personal Access Token* de GitLab con scope **`api`**. Es **otro** token, distinto del de `glab` y del de Jira. | Confundirlo con el de Jira. Cada servicio, el suyo ([ADR-0007](../adr/0007-modelo-de-autenticacion.md)). |

> **La URL de la US en Jira sale sola** de `DAI_JIRA_BASE_URL` (`…/browse/PROJ-125`). Solo si
> tu Jira usa otro esquema de URLs agregas `DAI_TRACKER_URL_TEMPLATE=https://…/{id}` — el
> `{id}` se deja tal cual: es el marcador que dai reemplaza.

---

## Paso 7 — Verifica

```powershell
dai doctor
```

Lo que te importa ver:

```
✓ Copilot: 7 skills
✓ constitución Copilot (.github/copilot-instructions.md)
› adaptador de PM:
✓ DAI_PM=jira
✓ token de Jira presente (no verificado: eso lo dice `dai publish`)
✓ proyecto=PROJ (para dai publish)
✓ .dai/ al día con el CLI (v0.11.0)
```

> **Ojo:** `dai doctor` solo comprueba que el token **esté escrito**, no que funcione. La
> prueba de verdad es el paso siguiente.

---

## Paso 8 — La prueba de fuego: toma una US de verdad

Vas a recorrer el ciclo completo con una US real del sprint. **No se publica nada hasta el
final** — y ahí te pregunta antes.

### 1. Abre el CÓMO desde el ID de la US

En el chat de Copilot, en modo *Agent*:

```
/link-us PROJ-125
```

O directo con el CLI, que es lo que la skill termina ejecutando:

```powershell
dai link-us PROJ-125
```

Trae la US de Jira, calcula el `ac_hash` de sus criterios y deja dos cosas:

```
✓ branch:  feature/PROJ-125-finalizar-la-compra-del-carrito
✓ archivo: openspec/changes/finalizar-la-compra-del-carrito/implements.yaml  (ac_hash 380d814b)
```

Ese `implements.yaml` es **el único archivo que se autora a mano** en todo el método
([ADR-0004](../adr/0004-ubicacion-y-schema-implements.md)):

```yaml
change: finalizar-la-compra-del-carrito
repo:   tienda

implements:
  - id: PROJ-125
    version: v1
    ac_hash: 380d814b

introduces:
  - <capacidad-tecnica>   # completar: specs técnicas nuevas de este change

autor: tu.nombre
```

Completa `introduces` con las capacidades técnicas nuevas del change (o bórralo si no hay).

> **El key no se tipea nunca a mano.** La rama y el `implements.yaml` salen los dos del mismo
> ID validado: por eso el link no puede quedar mal escrito.

> **Si te dice que la US no tiene criterios de aceptación**, frena: no es un problema de tu
> setup. Esa US no cumple el [DoR](../../templates/definition-of-ready.md) y vuelve al PO.

### 2. Arma el CÓMO y programa

```
/opsx:explore     → entender el terreno
/opsx:propose     → design.md + tasks.md sobre la rama ya linkeada
/opsx:apply       → el agente implementa las tareas con test primero (/tdd)
```

Tú validas el diseño, decides qué comportamientos importa testear y **revisas lo que escribió
el agente**: eres responsable del código, no la IA.

### 3. Commitea y comprueba el link

```powershell
git add -A
git commit -m "feat(carrito): rechazar la compra con carrito vacío"
dai check
```

```
✅ PROJ-125 al día (v1)
```

Si el PO tocó los criterios mientras implementabas, en vez de eso vas a ver:

```
⚠️  PROJ-125 ATRASADO: implementaste 380d814b, la US viva es 9f2c1a04 (v2)

  El QUÉ cambió desde que lo implementaste. Para resincronizar:
    dai link-us PROJ-125 --resync     # re-estampa el ac_hash contra la US viva
  Después, revisa si tu implementación cubre el criterio nuevo.
```

Eso es exactamente lo que dai viene a resolver: **no te avisa una persona, te avisa el link**.
Lee qué cambió en Jira, cúbrelo, y recién entonces resincroniza.

### 4. La MR

```powershell
dai mr --base develop
```

(`dai mr` y `dai pr` son el mismo comando; `mr` es el nombre natural en GitLab.)

Te muestra **todo** antes de tocar nada:

```
  ── Pull Request a crear ──────────────────────────────
  título:   PROJ-125: Finalizar la compra del carrito
  de:       feature/PROJ-125-finalizar-la-compra-del-carrito
  a:        develop
  US:       PROJ-125  — la branch 'feature/PROJ-125-…' nombra PROJ-125
  forge:    gitlab (glab)
  ─────────────────────────────────────────────────────
```

Debajo va el cuerpo completo de la MR, precargado con la US, el estado del `dai check`, tus
commits y los enlaces. Recién ahí pregunta:

```
  ¿Publico la branch y creo el PR con glab? (s/N)
```

Responde **`n`** para este ensayo si no quieres publicar todavía: te guarda el cuerpo en un
archivo temporal y no hace nada. Cuando sea de verdad, `s` sube la rama y crea la MR.

> **La línea `US:` dice de dónde salió la historia.** Si ahí aparece una US que no es la tuya,
> frena y revisa la rama: el título es lo único que se ve en la lista de MRs, y una MR
> rotulada con la historia de otro rompe justo lo que dai garantiza.

### 5. Después del merge

```powershell
dai stamp                 # estampa en Jira: implementado por <repo>, con rama y commit ancla
dai done --base develop   # vuelve a la base, actualiza y borra la rama local si está mergeada
```

`dai stamp` deduce **qué US** estampar del nombre de tu rama. Si el repositorio tiene varias
vivas y no puede saberlo, te pregunta antes de escribir en Jira: un comentario en el tracker no
se deshace.

Si las cinco partes te salieron, tu entorno funciona de punta a punta.

---

## Qué va dónde

⚠️ **Las skills no se ejecutan en PowerShell.** Son acciones que le pides a un **agente**, en el
chat de Copilot en modo *Agent*, escribiendo `/` adelante.

| Qué | Dónde se escribe | Ejemplos |
|---|---|---|
| Los comandos de **dai** | **PowerShell**, parado en el repositorio | `dai link-us` · `dai check` · `dai mr` · `dai stamp` · `dai done` |
| Las **skills** (empiezan con `/`) | El **chat de Copilot**, modo *Agent* | `/link-us` · `/tdd` · `/dai-review` · `/grill-intent` |
| Los comandos de **OpenSpec** | El **chat de Copilot** | `/opsx:explore` · `/opsx:propose` · `/opsx:apply` |

---

## Cuando algo falla

### `dai link-us` dice que no encontró la US en jira

Por orden de frecuencia:

1. **El key está mal** o es de otro proyecto. Cópialo de la URL del ticket
   (`…/browse/PROJ-125` → `PROJ-125`).
2. **No estás parado en el repositorio** que tiene el `.env.dai`. dai lee la configuración del
   directorio actual: `cd` al repositorio y reintenta.
3. **El token venció.** Ver el `jira 401` de abajo.

### `dai check` o `dai publish` dicen `jira 401`

El token no es válido o venció. Genera uno nuevo ([tutorial](./token-jira.md)) y pégalo de
nuevo en el `.env.dai`. Comprueba también que `DAI_JIRA_EMAIL` sea **exactamente** el correo de
tu cuenta de Atlassian.

### `dai mr` dice `hay N US vivas y la branch … no dice cuál`

Pasa cuando el repositorio tiene varios changes vivos y tu rama no nombra ninguno (una rama que
no creó `dai link-us`). No elige por ti: te lista las candidatas y te pregunta. Sin terminal
interactiva (en un pipeline) falla, y se lo dices explícito:

```powershell
dai mr --us PROJ-125
```

### `dai mr` dice `no hay una US linkeada (implements.yaml)`

Tu rama no tiene link y **sí** debería tenerlo (`feature/…` es trabajo de producto). Ejecuta
`dai link-us <ID>` primero.

Si en cambio es un cambio sin historia (tooling, limpieza, documentación), nombra la rama
`chore/…` o `docs/…`: esas están exentas de US
([`governance/branch-naming.md`](https://github.com/dforce2055/dai/blob/main/governance/branch-naming.md)),
y `dai mr` arma la MR **sin** US, con el título de tu último commit — en vez de colgarle la
historia de un compañero.

### `dai mr` no pudo subir la rama

Te muestra el error real de git debajo. Lo más común la primera vez contra un remoto HTTPS
corporativo es que git necesite abrir el login y no lo hayas completado. Autentica subiendo la
rama a mano una vez y vuelve:

```powershell
git push -u origin feature/PROJ-125-finalizar-la-compra-del-carrito
dai mr
```

### `dai mr` dice que `glab` no está instalado

La rama **ya se subió**; solo faltó crear la MR. dai te deja el cuerpo en un archivo y el
comando listo para ejecutar a mano. Instala `glab` ([tutorial](./instalar-glab.md)) o crea la
MR desde la web pegando ese cuerpo.

### Al salir a la red dice que no puede verificar el certificado

Es el **proxy de tu empresa**, que intercepta las conexiones con su propio certificado. Pide a
Sistemas el archivo `.pem` de la CA y decláralo:

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\ruta\ca-empresa.pem"
```

> ⛔ **Nunca uses `NODE_TLS_REJECT_UNAUTHORIZED=0`**, aunque lo veas sugerido en internet o te
> lo proponga un asistente. Eso no arregla nada: **apaga la verificación entera**, y por esa
> conexión viaja tu token de Jira.

### El CI falla con "falta el link"

Es el gate de [`governance/ci-rules.md`](https://github.com/dforce2055/dai/blob/main/governance/ci-rules.md),
ejecutable con `dai check --ci`. Córrelo local para ver lo mismo que ve el CI:

```powershell
dai check --ci
```

Te dice qué exige tu rama y por qué: `feature/` siempre requiere US, `chore/`/`docs/`/`ci/` y
compañía están exentas, `fix/` solo si el nombre trae un ID.

---

## Reglas de seguridad

- 🔒 **El `.env.dai` tiene tus tokens: son contraseñas.** Nunca lo pegues en un chat, en un
  ticket ni en una MR. Ya está fuera del control de versiones — déjalo así.
- 🔑 **Un token por servicio**: Jira, GitLab y `glab` son tres cosas distintas. No los reutilices
  ni los compartas.
- 🙅 **No aceptes atajos que bajen la seguridad.** Si algo falla por un certificado, se declara
  la CA; no se apaga la verificación.
- ♻️ **Rota los tokens** periódicamente y revoca los que no uses. Si se filtra uno, revócalo de
  inmediato.

---

## Lo que nunca tienes que hacer

- **No cambies el contenido funcional de la US ni sus criterios.** Si te parece que el QUÉ está
  mal, devuelves la US al PO: no se decide negocio desde el código. ¿Apareció un criterio nuevo
  mientras implementabas? Se empuja al tracker con `dai update-us PROJ-125`, para que el PO
  **se entere** de que la historia creció.
- **No empieces sin una US con criterios testeables.** Sin
  [DoR](../../templates/definition-of-ready.md) no hay dónde anclar el link, y eso es vibe
  coding con más pasos.
- **No edites el `ac_hash` a mano** para que `dai check` deje de quejarse. El ⚠️ es información,
  no un obstáculo: se resuelve con `--resync` **después** de cubrir el criterio nuevo.
- **No apruebes tu propia MR.** Tú haces tu propio review (paso 5 de la guía del dev); la firma
  es de un compañero.
- **No commitees el `.env.dai`** ni pegues tokens en la descripción de una MR.

---

## ¿Qué sigue?

El entorno ya está listo y probado. Lo que viene es tu día a día:

- 👉 [**Guía del dev / ingeniero**](../guias/dev.md) — **empieza aquí.** Tu rol de punta a
  punta: de qué eres dueño, qué no tocas, y los 10 pasos del día a día.
- [**Ejemplo end-to-end**](../EJEMPLO-END-TO-END.md) — el ciclo completo narrado sobre una US
  real, del `link-us` al `stamp`.
- [**Scrum con IA**](../SCRUM-CON-IA.md) — los 10 pasos del equipo, para ubicar dónde entra tu
  parte y dónde termina.
- [**Glosario**](../glosario.md) — el vocabulario del método: el QUÉ y el CÓMO, `ac_hash`,
  *atrasado*, el link.

> Eres dueño del CÓMO y autor del link. El QUÉ te llega definido, y el `ac_hash` es lo que hace
> que te enteres si cambia — sin reuniones y sin leer Jira todos los días.
