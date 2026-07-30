# Setup para analistas funcionales y PMs (Windows)

Guía paso a paso para dejar tu entorno listo y empezar a producir **épicas y User Stories**
con las skills de `dai` desde **GitHub Copilot**, publicándolas directo en **Jira**.

**No necesitas saber programar, ni usar git, ni clonar ningún repositorio.** Vas a usar la
terminal unas pocas veces, todas en esta guía, y después nunca más.

> **¿Qué son las skills?** Son los comandos que te **interrogan** hasta que la historia queda
> bien: `/doc-to-backlog` (un documento → un backlog candidato), `/grill-epic` (una épica),
> `/grill-user-story` (una US testeable). **No inventan requerimientos: te los sacan a
> preguntas.** Tú respondes y tú decides.
>
> Se escriben **en el chat de Copilot**, no en PowerShell: las ejecuta un agente, no la
> terminal. Más abajo está la tabla de qué va dónde.

**Atajo:** si ya tienes Node y `dai` instalados, salta al **Paso 3** — es el que te habilita
todo.

Los ejemplos usan `acme.atlassian.net` y el proyecto `PROJ`: reemplázalos por los de tu
empresa.

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

En la misma ventana:

```powershell
npm i -g @dforce2055/dai
```

Comprueba que quedó:

```powershell
dai --version
```

Si quieres ver todo lo que hace, `dai --help` te lista los comandos.

---

## Paso 3 — Instala las skills en Copilot (el comando clave)

**Este es el comando que te habilita todo:**

```powershell
dai skills install --for copilot --global
```

Te va a listar las skills instaladas. Comprueba que llegaron:

```powershell
dir $env:USERPROFILE\.copilot\skills
```

Tienes que ver 7 carpetas: `dai-review`, `doc-to-backlog`, `grill-epic`, `grill-intent`,
`grill-user-story`, `link-us`, `tdd`.

![Las 7 skills instaladas en la carpeta del usuario](/tutoriales/funcional-1-skills-usuario.png)

> **¿Por qué `--global`?** Porque las deja en **tu usuario**, no en un proyecto. Eso significa
> que los comandos te van a aparecer **en cualquier carpeta**, sin preparar nada. Es lo que
> hace que no necesites un repositorio para trabajar
> ([ADR-0014](../adr/0014-copilot-agent-skills.md)).

---

## Paso 4 — Comprueba que Copilot las ve

Si todavía no iniciaste sesión en Copilot, hazlo ahora: VS Code te lo pide solo, con la cuenta
de GitHub que tiene tu licencia. Si tu empresa usa inicio de sesión único (SSO), sigue el flujo
que te muestre.

![Iniciar sesión en GitHub Copilot](/tutoriales/funcional-2-copilot-signin.png)

Reinicia Copilot (cierra y abre la sesión) y escribe `/` en el chat, en modo **Agent**. Tienen
que aparecer las 7, marcadas **`User Data`** — esa etiqueta confirma que salen de tu usuario y
no de un proyecto.

> **Si no aparecen:** ejecuta `/skills` dentro de Copilot para refrescar el listado. Si sigue
> sin verlas, recarga la ventana: `Ctrl+Shift+P` → **Developer: Reload Window**.

---

## Paso 5 — Crea tu carpeta de trabajo

Las skills ya te funcionan en cualquier lado. **Pero para publicar en Jira hace falta una
carpeta con la configuración**: aquí van tus documentos y aquí vive el token.

```powershell
mkdir $HOME\backlog
cd $HOME\backlog
dai init --for copilot --pm jira
```

Te va a preguntar si quieres instalar **OpenSpec**: responde **`n`**. OpenSpec es el motor del
*cómo* (lo técnico) y un funcional no lo usa nunca.

![La carpeta configurada: .dai/, .github/skills y .env.dai](/tutoriales/funcional-3-carpeta-configurada.png)

> **Importante:** de aquí en adelante trabaja siempre **parado en esta carpeta**
> (`cd $HOME\backlog`). Es donde dai busca tu configuración de Jira.

---

## Paso 6 — Conecta Jira

`dai init` te dejó un archivo `.env.dai` ([ADR-0017](../adr/0017-env-dai.md)). Hay que
completarlo.

Primero necesitas un **token de API de Atlassian**. Si no tienes, sigue el tutorial
👉 **[Cómo obtener el token de API de Jira](./token-jira.md)** y vuelve con el token copiado.

Abre la carpeta en el editor:

```powershell
code .
```

Abre el `.env.dai` y complétalo:

```bash
DAI_PM=jira
DAI_JIRA_BASE_URL=https://acme.atlassian.net
DAI_JIRA_EMAIL=tu.correo@acme.com
DAI_JIRA_TOKEN=el-token-que-copiaste
DAI_JIRA_PROJECT=PROJ
DAI_JIRA_ISSUETYPE=Story
DAI_JIRA_FIELDS_FILE=.dai/jira-fields.json
DAI_TRACKER_URL_TEMPLATE=https://acme.atlassian.net/browse/{id}
```

Guarda con `Ctrl+S`.

### Los dos que más se equivocan

| Variable | Qué va | El error típico |
|---|---|---|
| `DAI_JIRA_PROJECT` | La clave del **proyecto**: las letras antes del guion. Si tus tickets son `PROJ-123`, va **`PROJ`**. | Pegar la clave de un **ticket** (`PROJ-123`). Eso es un ticket, no un proyecto. |
| `DAI_TRACKER_URL_TEMPLATE` | Viene vacío, complétalo. Deja el `{id}` tal cual: es un marcador que dai reemplaza solo. | Reemplazar el `{id}` por un número. |

> **Si te equivocas en `DAI_JIRA_PROJECT`, dai te lo dice** y te da los dos caminos:
> ```
> dai: DAI_JIRA_PROJECT='PROJ-123' es la clave de un ticket, no la del proyecto.
>   Usá solo la parte de adelante:  DAI_JIRA_PROJECT=PROJ
>   Si lo que querías era colgar la US de esa épica:  dai publish <us.md> --parent PROJ-123
> ```

---

## Paso 7 — Verifica todo

```powershell
dai doctor
```

Lo que tienes que ver:

```
✓ DAI_PM=jira
✓ token de Jira presente (no verificado: eso lo dice `dai publish`)
✓ proyecto=PROJ (para dai publish)
```

![dai doctor con la configuración de Jira completa](/tutoriales/funcional-4-doctor.png)

> **Ojo:** `dai doctor` solo comprueba que el token **esté escrito**, no que funcione. Si está
> vencido o mal pegado, doctor te dice que está todo bien y el error recién aparece al
> publicar. La prueba de verdad es publicar una US — es el paso siguiente.

---

## Paso 8 — La prueba de fuego: publica una épica y una US

Vas a crear **dos issues de prueba** en Jira —una épica y una US colgada de ella— y después los
borras. De paso ves el flujo completo, que es exactamente lo que hacen las skills por ti.

### 1. Una carpeta para tus US

```powershell
cd $HOME\backlog
mkdir US
```

### 2. La épica (opcional)

Este paso es opcional: si en tu proyecto **ya existe** la épica, salta al punto 3 y usa su key.

```powershell
code US\epica-prueba.md
```

VS Code abre el archivo nuevo. Pega esto y guarda con `Ctrl+S`:

```markdown
# Compra del carrito

## Objetivo de negocio

Que un cliente pueda comprar lo que puso en el carrito sin depender de nadie del equipo.

## Alcance

- **Dentro** — finalizar la compra y ver el detalle antes de confirmar.
- **Fuera** — nuevos medios de pago, facturación.

## User Stories (partición)

- [ ] Finalizar la compra del carrito
```

Publícala **como épica**:

```powershell
dai publish US\epica-prueba.md --issuetype Epic
```

Te responde con el key y el link:

```
✓ US publicada en jira: PROJ-124  →  https://acme.atlassian.net/browse/PROJ-124
› Próximo paso (el dev abre el CÓMO):  dai link-us PROJ-124
```

La línea *Próximo paso* es para el dev (`dai link-us` es lo que abre el CÓMO): tú no la
necesitas.

**Anota ese key** (`PROJ-124` en el ejemplo): lo necesitas en el paso siguiente.

### 3. La US, colgada de la épica

```powershell
code US\us-prueba.md
```

Pega esto y guarda con `Ctrl+S`:

```markdown
# Finalizar la compra del carrito

## Historia

Como **cliente con productos en el carrito**
quiero **finalizar la compra**
para **recibir lo que elegí sin tener que llamar a nadie**.

## Criterios de aceptación

- [ ] **AC-1** —
  - **Dado** un carrito con al menos un producto
  - **Cuando** finalizo la compra
  - **Entonces** se registra el pedido y recibo la confirmación.
- [ ] **AC-2** —
  - **Dado** un carrito vacío
  - **Cuando** intento finalizar la compra
  - **Entonces** se rechaza y se me avisa que el carrito está vacío.
```

Publícala colgada de la épica — cambia `PROJ-124` por **tu** key:

```powershell
dai publish US\us-prueba.md --parent PROJ-124
```

```
✓ US publicada en jira: PROJ-125  →  https://acme.atlassian.net/browse/PROJ-125
› colgada de PROJ-124
› Próximo paso (el dev abre el CÓMO):  dai link-us PROJ-125
```

![Publicar la US colgada de la épica](/tutoriales/funcional-5-publish-parent.png)

> **La épica no tiene que ser de dai.** `--parent` acepta cualquier épica que ya exista en el
> proyecto: la key se saca de la URL del navegador (`…/browse/PROJ-77` → `PROJ-77`). Dos
> límites: la épica tiene que estar en el proyecto de `DAI_JIRA_PROJECT` (si no, `--project`),
> y `dai publish` siempre **crea** — para mover una US que ya existe a una épica, se hace en
> Jira a mano.

> **Si tu Jira exige campos propios**, los dos comandos llevan además `--field alias=valor`
> (p. ej. `--field tipo=Mejora`). Está explicado abajo, en *Al publicar dice `jira 400` y
> nombra un `customfield_NNNNN`*.

### 4. Comprueba en Jira

Abre el link de la US y mira **tres cosas**:

| Qué mirar | De dónde salió |
|---|---|
| El **título** del issue | el `# Título` del archivo (el primero que no sea *Metadata*) |
| La descripción con el bloque **Criterios de aceptación** | el archivo entero viaja como descripción |
| La US **dentro** de la épica `PROJ-124` | el `--parent` |

Si las tres están, tu entorno funciona de punta a punta. **Borra los dos issues de prueba**
desde Jira y sigue con tu backlog real.

> **Lo importante es el heading `## Criterios de aceptación`.** Es el bloque del que dai saca
> el `ac_hash` ([ADR-0001](../adr/0001-contrato-ac-hash.md)): lo que después le avisa al equipo
> técnico si cambiaste los criterios. Sin ese heading la US se publica igual, pero queda sin
> link con el código. Por eso las skills lo escriben siempre tal cual.

> **¿Todavía no tienes Jira?** El mismo ejemplo corre con `DAI_PM=md` en el `.env.dai`: en vez
> de crear el issue, `dai publish` te guarda la US en `.dai\us\` y devuelve un slug
> (`✓ US publicada en md: finalizar-la-compra-del-carrito`). Sirve para probar el formato sin
> token, pero `--parent` no hace nada: sin tracker no hay épica de la que colgar.

---

## Ya puedes trabajar

```
  tu documento  →  /doc-to-backlog  →  /grill-epic  →  /grill-user-story  →  Jira
                   (candidatos)        (una épica)     (cada US)
```

De aquí en adelante no vas a escribir estos `.md` a mano: las skills te interrogan, arman la
épica y las US con el formato completo, y las publican con estos mismos comandos.

> ⚠️ **IMPORTANTE — las skills no se ejecutan en PowerShell.** Funcionan con un **agente**: son
> acciones que le pides **en el chat de Copilot** (modo *Agent*), escribiendo `/` adelante. Si
> pegas `/grill-epic` en PowerShell, te va a decir que no reconoce el comando.

| Qué | Dónde se escribe | Ejemplos |
|---|---|---|
| Los comandos de **dai** | **PowerShell**, parado en tu carpeta | `dai init` · `dai doctor` · `dai publish` |
| Las **skills** (empiezan con `/`) | El **chat de Copilot**, en modo *Agent* | `/doc-to-backlog` · `/grill-epic` · `/grill-user-story` |

PowerShell lo usaste en los pasos 1 a 8 para **preparar el entorno y publicar**. El trabajo de
todos los días —sacar el backlog de un documento, armar la épica, pulir cada US— pasa en el
chat. Y cuando la skill necesita publicar, **ella** ejecuta el `dai publish` por ti.

---

## Cuando algo falla

### Al publicar dice `no pude extraer el título de la US`

dai toma el título del **primer `# ` del archivo** y no lo encontró. Dos causas, en orden de
frecuencia:

1. **El `#` no está solo o no está al principio de la línea.** Tiene que ser `# Título`, con el
   espacio, empezando en el borde izquierdo. `#Título` o ` # Título` no cuentan.
2. **El archivo se guardó con BOM** (una marca invisible al inicio que agregan algunas
   herramientas). El título está ahí y aun así dai no lo ve. Se arregla guardando desde
   VS Code, que usa **UTF-8 sin BOM**: `Ctrl+Shift+P` → **Change File Encoding** → *Save with
   Encoding* → **UTF-8**.

> Por eso la guía te hace crear los `.md` con `code archivo.md` y no con comandos de PowerShell
> tipo `Set-Content`: el editor los guarda bien de entrada.

### Al publicar dice `jira 401`

El token no es válido o venció. Genera uno nuevo
([tutorial](./token-jira.md)) y vuelve a pegarlo en el `.env.dai`. Comprueba también que
`DAI_JIRA_EMAIL` sea **exactamente** el correo de tu cuenta de Atlassian.

### Al publicar dice `jira 400` y nombra el `project`

El mensaje dice que el proyecto no existe o que no tienes permiso para crear issues en él.
Tres causas, en orden:

1. **`DAI_JIRA_PROJECT` no es la clave de ese proyecto.** Abre el proyecto en Jira: la clave
   está en la URL (`…/browse/PROJ-1` → `PROJ`). `dai doctor` te dice cuál está usando.
2. **La cuenta del token no puede crear issues ahí.** Entra a Jira con esa misma cuenta e
   intenta crear un issue a mano en ese proyecto: si el proyecto no aparece en el selector, es
   permisos y los da el administrador del proyecto.
3. **`DAI_JIRA_BASE_URL` apunta a otro site** del que salió el token. Si el token es de otra
   instancia, el proyecto "no existe" desde ahí.

> **El mensaje puede llegarte en otro idioma.** Jira responde los errores de la API en el
> idioma del perfil de Atlassian de la cuenta autenticada. Se cambia en Atlassian →
> *Configuración de la cuenta* → *Idioma*.

### Al publicar dice `jira 400` y nombra un `customfield_NNNNN`

Tu proyecto **exige un campo propio** al crear un issue (muy común en Jira corporativo). No es
un error tuyo: hay que declararle ese campo a dai
([ADR-0015](../adr/0015-jira-corporativo.md)).

Crea el archivo `.dai\jira-fields.json` en tu carpeta — el molde está en
`.dai\templates\jira-fields.example.json`. Por ejemplo, si tu Jira exige un desplegable:

```json
{
  "Story": {
    "tipo": {
      "field": "customfield_10042",
      "shape": "select",
      "options": ["Mejora", "Corrección"]
    }
  }
}
```

- **`field`** es el `customfield_NNNNN` que te nombró el error.
- **`options`** son los valores válidos. dai los valida **antes** de llamar a Jira, así que un
  error de tipeo te lo dice al instante en vez de un 400 críptico.
- **Sin `default`**, dai te va a pedir el valor en cada publicación (útil cuando cambia según la
  historia).

Y publicas así:

```powershell
dai publish us.md --field tipo=Mejora
```

Comprueba que el archivo esté bien escrito con `dai doctor`.

### Al publicar dice que no puede verificar el certificado

Es el **proxy de tu empresa**, que intercepta las conexiones con su propio certificado. dai te
va a decir qué hacer: pide a Sistemas el archivo `.pem` de la CA de la empresa y declárala:

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\ruta\ca-empresa.pem"
```

> ⛔ **Nunca uses `NODE_TLS_REJECT_UNAUTHORIZED=0`**, aunque lo veas sugerido en internet o te
> lo proponga un asistente. Eso no arregla nada: **apaga la verificación entera**, y por esa
> conexión viaja tu token de Jira.

---

## Reglas de seguridad

- 🔒 **El `.env.dai` tiene tu token: es una contraseña.** Nunca lo pegues en un chat, en un
  ticket ni en un documento compartido. `dai init` ya lo dejó fuera del control de versiones.
- 🙅 **No aceptes atajos que bajen la seguridad.** Si algo falla por un certificado, se declara
  la CA; no se apaga la verificación.
- ♻️ **Rota el token** periódicamente y revoca los que no uses.
- 🧯 **Si se filtra**, revócalo de inmediato y crea uno nuevo.

---

## Lo que nunca tienes que hacer

- **No entres al código.** Tu trabajo termina en la US publicada. El *cómo* es del dev.
- **No escribas soluciones técnicas en las US.** Si te encuentras escribiendo "agregar una
  columna a la tabla", frena: eso es el cómo. La US dice **qué** necesita el usuario y **por
  qué**.
- **No aceptes un criterio que no puedas testear.** Si no sabes cómo comprobarlo, el dev
  tampoco. Cuando la skill te insiste con eso, está trabajando bien.
- **No trates el documento como un mandato.** Es la materia prima: un menú, no una orden. Tú
  decides qué entra.

---

## ¿Qué sigue?

El entorno ya está listo y probado. Lo que viene es tu día a día:

- 👉 [**Guía del PO / funcional**](../guias/po.md) — **empieza aquí.** Tu rol de punta a punta:
  de qué eres dueño, qué no tocas, y el día a día paso por paso (nace la idea o llega un
  documento → `/grill-user-story` te interroga → Gate 0 con `/grill-intent` → el dev
  implementa el CÓMO → tú aceptas en la demo).
- [**Scrum con IA**](../SCRUM-CON-IA.md) — los 10 pasos del equipo completo, para ubicar dónde
  entra y dónde termina tu parte.
- [**Glosario**](../glosario.md) — el vocabulario del método: el QUÉ y el CÓMO, `ac_hash`,
  *atrasado*, el link.

> Tu trabajo termina en la **US publicada y aceptada**. Lo que pasa entre una y otra —ramas,
> tests, PRs— es del dev, y el link QUÉ↔CÓMO es lo que te deja verlo sin entrar al código.
