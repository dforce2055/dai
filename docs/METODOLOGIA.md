# Metodología de Desarrollo Asistido por IA

> **Fuente de verdad única.** Este documento es el maestro. Los dos HTML
> (`desarrollo-asistido-por-ia.html` federado y `-equipos-compactos.html`) son
> **vistas de presentación** derivadas de acá — si algo contradice a este `.md`,
> gana este `.md`. Versionado por git para que no driftee.

Una sola metodología para dos escalas opuestas:

- **Organización grande** — muchos procesos, muchos repos y desarrolladores,
  funcional/PO y devs separados, tracker central (tipo Jira).
- **Equipo chico** — pocos desarrolladores que suelen usar los dos sombreros
  (definen el QUÉ y el CÓMO), tracker liviano o ninguno.

No son dos metodologías. Es **un protocolo invariante** con **un dial de tres
niveles de ceremonia** — **N1** (un dev solo), **N2** (equipo compacto) y **N3**
(organización grande, federada), que se detallan en la
[§3](#3-el-dial-tres-niveles-de-ceremonia). El dev que aprende la ceremonia como sólo
developer o en equipo chico ya tiene todas las herramientas de la escala grande — solo le
suben la plomería.

---

## 1. Los tres problemas que resolvemos

1. **Trazabilidad** entre especificaciones e implementación, desde el
   requerimiento hasta el código — y de vuelta.
2. **Velocidad + calidad** del desarrollo asistido por IA: mejores specs, menos
   retrabajo.
3. **No vibe coding**: implementación estructurada y estandarizada, no
   improvisación. Se logra con una US bien definida + una herramienta de
   implementación disciplinada (OpenSpec) + TDD.

La idea rectora: **separar el QUÉ del CÓMO** y mantenerlos **linkeados ida y
vuelta**, *sin importar la herramienta de abajo*.

| | **El QUÉ** | **El CÓMO** |
|---|---|---|
| Dueño | funcional / PO | dev / ingeniero |
| Herramienta | Jira/ClickUp + `grill-user-story` (o el `proposal.md` de OpenSpec en N1) | OpenSpec (o swagger, yml, md…) |
| Fuente de verdad de… | el contenido funcional | la relación QUÉ↔CÓMO y la implementación |

---

## 2. El protocolo invariante (igual en los tres niveles)

Esto **no cambia nunca**, ni en el equipo chico ni en la organización grande. Es
lo que hace que sea *una* metodología.

### 2.1 Identidad estable

Todo QUÉ tiene un **ID único e independiente del path o del formato**. No se
inventa un esquema nuevo: el ID **es** el ticket del gestor (`ABC-###` en Jira,
el ID de ClickUp) o —en N1— el nombre del change de OpenSpec. El QUÉ nace con
identidad el día que se crea el ticket/change.

### 2.2 Formato linkeable garantizado

El QUÉ se produce con una forma mínima **testeable**: `id · spec_version · autor ·
criterios de aceptación en Gherkin`. Es exactamente lo que aseguran las skills
`grill-intent` → `grill-user-story` (ver `formato-us.md`). Sin esa forma, no hay
a qué linkear.

### 2.3 El link se autora una sola vez, del lado del CÓMO

El código declara `implements: <id>@<version>`. **Es el único link escrito a
mano.** La dirección inversa (cobertura: "quién implementó este QUÉ") **siempre se
genera**, nunca se escribe. Si se escribiera en los dos lados, se desincronizan al primer
cambio.

> **Regla de oro:** el link se escribe en un solo lado; la inversa se deriva. La
> matriz de trazabilidad no la mantiene nadie — se calcula.

### 2.4 `@version` = número + hash

```
@version  =  spec_version  +  ac_hash
             (nº legible)     (hash de los criterios de aceptación)
```

- **`spec_version`** (`v1`, `v2`…) lo sube la persona para **comunicar** un cambio
  material del QUÉ.
- **`ac_hash`** lo calcula la máquina para **detectar**. Es el hash del bloque de
  *Criterios de aceptación* normalizado (whitespace colapsado, orden estable).

Cuando el QUÉ evoluciona, cambia el `ac_hash`; todos los CÓMO que declaran el hash
viejo quedan marcados **atrasados** solos. El funcional ve "el backend todavía no
tomó mi cambio"; el dev ve "el QUÉ que implementé cambió". Nadie avisa a nadie — el
link versionado lo grita.

- Cambio **material** de los AC → cambia el hash → re-marca repos atrasados.
- Cambio **editorial** (typo, formato) → la normalización lo absorbe → **no**
  dispara falso atraso.

### 2.5 Trazabilidad federada de dos niveles

El índice central es un **router, no un almacén**:

```
NIVEL 1 — Índice (central, grueso, chico, estable)
  ABC-001  →  implementado en: { backend, bff, frontend } @ v3

NIVEL 2 — Detalle (federado, en cada repo, se resuelve ON-DEMAND)
  backend  ── resolve implements=ABC-001 ──►  su change / spec técnica
  bff      ── resolve implements=ABC-001 ──►  su change / spec técnica
  frontend ── resolve implements=ABC-001 ──►  su change / spec técnica
```

Una funcionalidad que toca 3 repos **no** genera 3× de mantenimiento central:
genera **una fila** con 3 destinos. El detalle se lee del repo cuando se necesita,
siempre fresco.

### 2.6 Granularidad del link: **capacidad entera** (norma)

`implements` es a nivel de **capacidad/US entera**, no criterio-por-criterio.
Si el QUÉ sabe *quién* lo implementó, obtener el detalle fino es trivial: se
resuelve el ID en el repo que interese. Criterio-por-criterio es trazabilidad
quirúrgica pero insostenible con multi-repo. **Decidido: capacidad entera +
federación.**

### 2.7 TDD como norma de implementación

El CÓMO se construye con **test primero**, en *vertical slices* (un test → una
implementación → repetir), verificando por la **interfaz pública**, no espiando lo
interno. Un buen test lee como una spec y sobrevive a un refactor. Ver
`skills/tdd/`.

---

## 3. El dial: tres niveles de ceremonia

**Misma metodología, distinto nivel según escala.** Cada capa se agrega **cuando
duele, no antes.**

| | **N1 · Solo / 1 repo** | **N2 · Equipo compacto** | **N3 · Federado** |
|---|---|---|---|
| Caso típico | equipo chico arrancando, un dev | equipo chico | organización grande |
| El QUÉ vive en | `proposal.md` de OpenSpec | ClickUp (US) → el change la referencia | Jira (`ABC-###`, hub) |
| El link vive en | la carpeta del change (co-localizado) | `implements.yaml` en el repo | `implements.yaml` versionado |
| Inversa la genera | un comando local | comando / CI liviano | CI estampa cobertura + CD reporta ambiente |
| Índice central | no hace falta (todo co-localizado) | opcional (ClickUp como vista) | Jira = índice/router de la federación |
| Roles | 1 persona, ambos sombreros | pocos devs, PO informal | funcional/PO y devs separados |
| Gates | auto-review | review de un partner | Gate 0 formal + MR review + matriz repo×ambiente |
| Multi-repo | no | opcional (p. ej. front + back) | sí, es el punto |

### Regla de escala

> Empieza con lo mínimo que funciona (**N1: OpenSpec solo**). Suma ClickUp cuando el
> equipo lo pida (**N2**). Pasa al modelo federado solo cuando la escala lo
> justifique (**N3**). No adelantes complejidad.

El equipo chico vive en N1–N2 y quizás nunca necesite N3. La organización grande
vive en N3. **Ninguno mantiene dos metodologías** — es el mismo protocolo
(sección 2) con distinta plomería.

### Colapso de roles (clave para equipos chicos)

En un equipo chico una misma persona suele ser autor del QUÉ **y** del CÓMO. La metodología
lo permite **sin romper la trazabilidad**: el link `implements` sigue existiendo
aunque `autor_QUÉ == autor_CÓMO`, y los gates se **colapsan** (el Gate 0 y el
partner-review pasan a ser un auto-check honesto, no una firma de otra persona).
El artefacto no desaparece; se aligera la ceremonia alrededor.

---

## 4. Responsabilidades (quién autora qué)

| | Autora | Herramienta | Fuente de verdad de… |
|---|---|---|---|
| QUÉ | PO / funcional (o el dev en N1) | Jira/ClickUp + `grill-user-story` | el contenido funcional |
| Link | dev / ingeniero | `implements:` en el código | la relación QUÉ↔CÓMO |
| Índice / vista inversa | CI (nadie a mano) | generado → publicado al PM | derivado, siempre verdadero |
| Implementación (CÓMO) | dev / ingeniero | OpenSpec + TDD | el código y su spec técnica |

---

## 5. El flujo, punta a punta

```
   ①  Nace la idea            → ticket vago en el PM (o intención suelta en N1)
   ②  Gate 0: ¿problema OK?   → /grill-intent  → veredicto: a-spec / reframe / descartar
   ③  Se pule el QUÉ          → /grill-user-story → US testeable (formato-us.md),
                                 publicada en Jira/ClickUp (o .md si no hay MCP)
   ④  Se abre el CÓMO         → /link-us ABC-###  → branch + implements.yaml ligados al ID
   ⑤  Se arma el change       → opsx:explore → opsx:propose (proposal/design/tasks + specs)
   ⑥  Se implementa           → TDD (red → green → refactor), vertical slices
   ⑦  Se promueve             → opsx:apply → opsx:archive; el CI estampa cobertura en el PM
   ⑧  Se despliega            → el CD reporta a qué ambiente (dev/test/pre/prod) fue la versión
```

- **En N1** los pasos ②–④ se colapsan: el `proposal.md` de OpenSpec **es** el QUÉ,
  el change **es** el tracker, no hay PM externo.
- **En N2** aparece ③ (US en ClickUp) y el `implements.yaml` referencia esa US.
- **En N3** el flujo completo, con los gates formales y el CI/CD estampando estado
  por repo y por ambiente.

**Implementación ≠ despliegue.** El CI dice "el repo implementó `@v3`"; el CD dice
"`@v3` está viva en `pre`, todavía no en `prod`". Se rastrea por ambiente.

---

## 6. Las skills del proceso

| Skill | Lado | Qué hace |
|---|---|---|
| `grill-intent` | QUÉ | Gate 0: desafía el *problema* antes de escribir spec. Veredicto: a-spec / reframe / descartar. |
| `grill-user-story` | QUÉ | Interroga hasta producir una US testeable (INVEST + Gherkin). Publica en Jira/ClickUp o deja `.md`. |
| `link-us` | CÓMO | Crea branch + `implements.yaml` desde el ID del PM. El link, correcto por construcción. |
| `tdd` | CÓMO | Red-green-refactor en vertical slices, tests por interfaz pública. |
| `opsx:*` | CÓMO | OpenSpec: explore → propose → apply → archive. Lo provee OpenSpec. |

El **adaptador de PM** es un seam único: las skills del QUÉ publican en Jira **o**
ClickUp **o** dejan un `.md` según qué MCP/token haya. Es la **misma** skill con
distinto backend — no se bifurca por tamaño de equipo.

---

## 7. Decisiones abiertas (plomería de N3)

El protocolo (sección 2) está cerrado **e implementado** en el CLI `dai`. De la plomería
de N3 queda **una** decisión sin resolver; el resto se cerró al construir la herramienta.

1. **Reporte de despliegue por ambiente (CD).** Cómo el CD reporta a Jira qué versión vive
   en cada ambiente (`dev`/`test`/`pre`/`prod`), para la matriz repo×ambiente. dai hoy
   estampa **cobertura** (implementación), no **despliegue** — *implementación ≠ despliegue*
   (§2.5). Sigue abierta porque depende del pipeline que cada organización ya tenga; no la
   fuerza el método ([ADR-0003](adr/0003-deteccion-y-estampado-son-comandos.md)).

**Ya resueltas** (al construir dai):
- **Adaptador de PM configurable** → `getAdapter` (backends `md`/`jira`/`clickup`, token del
  `.env`); modelo de auth en [ADR-0007](adr/0007-modelo-de-autenticacion.md).
- **Formato de `implements.yaml`** → congelado en [ADR-0004](adr/0004-ubicacion-y-schema-implements.md)
  (schema + ubicación + descubrimiento por glob).
- **Escritura multi-repo en el tracker** → `dai stamp` deja un **comentario por repo** (no se
  pisan); superficie de comandos en [ADR-0005](adr/0005-superficie-comandos-y-stamp.md). Una org
  N3 grande podría preferir un panel/custom-field, pero el mecanismo por defecto está decidido.
- **`ac_hash`** = algoritmo + tres momentos ([ADR-0001](adr/0001-contrato-ac-hash.md), en `dai ac-hash`) ·
  **detección/estampado como comandos** ([ADR-0003](adr/0003-deteccion-y-estampado-son-comandos.md)) ·
  **agnóstico del asistente** ([ADR-0002](adr/0002-agnostico-del-asistente.md)) · granularidad = capacidad
  entera (§2.6) · colapso de roles (§3) · formato de US + skills del QUÉ.

---

## 8. En resumen (para no técnicos)

El **funcional** dice *qué* hay que hacer, en su herramienta de siempre (Jira),
sin entrar nunca al editor de código. Una IA lo ayuda a que ese "qué" quede claro y
testeable. El **dev** dice *cómo* se hace, en su repo, y deja una etiqueta que
apunta al "qué". A partir de ahí, **una máquina** arma sola el mapa de quién hizo
qué, contra qué versión, y quién quedó atrasado — sin que nadie lo mantenga a mano.
Si el funcional cambia el "qué", el mapa marca solo a los que todavía no lo
tomaron. En un equipo chico la misma persona hace las dos cosas y todo vive en una
carpeta; en una organización grande hay equipos separados y el mapa lo publica el
CI en el tracker. **Es el mismo método; cambia cuánta maquinaria le cuelgas.**
