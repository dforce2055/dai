# ADR-0018 — El alcance de `stamp` lo decide la rama, el gate de CI se ejecuta, y editar el QUÉ es un comando

- **Estado:** aceptado
- **Fecha:** 2026-07-22
- **Decide:** lead / arquitecto de la metodología

## Contexto

Tres agujeros con la misma raíz: **dai suponía cosas sobre el QUÉ que nunca escribió en
ningún lado** — que un repo tiene una sola US viva, que toda rama implementa una US, y que
la US, una vez publicada, no se vuelve a tocar. Las tres suposiciones fallan en el primer
sprint real.

### 1. `dai stamp` estampaba todo el repo

`cmdStamp` recorría el repo entero con `discoverImplements(cwd)` —**archivados
incluidos**— y le dejaba un comentario de cobertura a cada US que encontrara. Cerrar una
historia dejaba esto en el tracker:

```
➜  backend git:(feature/331qtr-historia-motor) dai stamp
✓ 86acme482 → task 86acme482 (comentario)  (✅ al día)
✓ 86acme483 → task 86acme483 (comentario)  (✅ al día)
✓ 86acme484 → task 86acme484 (comentario)  (✅ al día)
✓ 86acme485 → task 86acme485 (comentario)  (✅ al día)
```

Tres de esos cuatro comentarios son ruido en el ticket de otra persona. Y un comentario
en un tracker **no se deshace**: queda en el historial de la US, en la notificación por
mail de quien la sigue, y en el Slack del canal conectado.

Lo llamativo es que `dai check` **ya** filtraba los archivados (`includeArchived: false`,
ADR-0010) y `stamp` no. La divergencia era un descuido, no una decisión.

### 2. `governance/ci-rules.md` prometía un gate que no existía

El documento decía, en una tabla, que el CI **bloquea** el PR si una rama de producto no
tiene `implements.yaml`. No había ningún comando que hiciera eso. No estaba en `ci.yml`,
no estaba en el CLI, no estaba en ningún template. Era una regla escrita que nadie
aplicaba — el peor estado posible: el equipo cree que está protegido y no lo está.

Y al ir a implementarla apareció el problema real, el que probablemente explica por qué
nunca se implementó: **la regla como estaba escrita es demasiado dura**. Un `chore/` de
bump de dependencias, un `docs/` de typo, un `hotfix/` de las tres de la mañana no
tienen US, no deberían tenerla, y un gate que los bloquea se desactiva la primera semana.
Un gate desactivado protege exactamente igual que un gate que no existe, pero además
enseña al equipo que los checks de dai son un obstáculo.

### 3. Editar una US publicada era copiar y pegar

`dai publish` creaba la US y `dai check` detectaba que había cambiado. En el medio no
había nada: para **editarla** el PO abría el navegador y escribía en un textarea sin
validación, o el dev editaba el `us.md` local y el tracker quedaba viejo. El formato
canónico (`templates/formato-us.md`) existía como documento y no como chequeo, así que una
US podía volver al tracker sin criterios y nadie se enteraba hasta que `dai link-us`
fallaba, sprints después.

## Decisión

### 1. El alcance de `stamp` sale del nombre de la rama, y ante la duda se pregunta

`dai stamp` deja de recorrer el repo. La decisión vive en un módulo puro
(`cli/lib/branch-scope.mjs`) que responde **qué estampar y por qué**:

| Situación | Qué hace |
|---|---|
| `dai stamp ABC-482` | esas US, aunque el change esté archivado |
| `dai stamp --all` | todo (el comportamiento viejo, ahora explícito) |
| la rama nombra una US del repo | **solo esa** |
| hay una sola US viva | esa |
| varias US vivas y la rama no dice cuál | **no estampa: pregunta** |

Los changes archivados **salen del default**. Se alcanzan con `--all` o nombrando el ID
—que es justo el caso de estampar después del merge.

> **El default es preguntar, no estampar de más.** Es la asimetría del costo: no estampar
> se arregla corriendo el comando otra vez; estampar de más deja cuatro comentarios que
> no se borran. Cuando no hay TTY (CI), en vez de preguntar **falla** y pide el ID
> explícito — que es lo que un pipeline debería estar pasando de todos modos.

El matcheo rama↔US es deliberadamente conservador: `feature/331qtr-historia-motor` **no**
matchea `86acme482` aunque ambos sean alfanuméricos. Se comparan candidatos del nombre
contra los IDs que el repo realmente declara, y si no hay coincidencia exacta se pregunta.

Para el gate —que no tiene contra qué comparar, justamente porque el `implements.yaml` no
existe— un key de tracker se reconoce por **MAYÚSCULAS + guion + números** (`ABC-482`). El
case es lo único que lo separa de una palabra del slug con un número pegado: dogfoodeando
esto, la rama `feat/issues-22-26` hacía que el gate sugiriera `dai link-us issues-22`, o
sea mandar al dev a crear un link inventado. `dai link-us` preserva el case del key, y los
keys de tracker son mayúsculas por convención en Jira, GitLab y Azure Boards.

### 2. El gate es un comando, y sabe qué ramas no exigir

```bash
dai check --ci     # 0 = pasa · 1 = falta el link · 2 = el QUÉ cambió
```

Lee el nombre de la rama y aplica `branch-naming.md`:

- `feature/`, `feat/` → **siempre** exige `implements.yaml`
- `chore/`, `docs/`, `ci/`, `build/`, `test/`, `refactor/`, `style/`, `release/`,
  `hotfix/`, `revert/` → **exentas**
- `fix/` y cualquier otro prefijo → exige **solo si el nombre trae un ID** de tracker
- sin prefijo (`main`, `develop`) → no es rama de trabajo

> El nombre de la rama **es** la declaración del tipo de trabajo. Si el gate te bloquea
> un chore, la respuesta no es inventarle una US: es renombrar la rama. Esto convierte
> `branch-naming.md` de convención sugerida en algo con consecuencia, sin agregar
> ceremonia nueva.

En CI, la rama de una PR no se saca de git: `HEAD` es un merge commit detached. El
comando lee `GITHUB_HEAD_REF` / `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` / equivalentes.

### 3. El gate no bloquea por falta de red ni de credencial

`--no-network` valida el link y no compara contra la US viva; es el **default del
template** (`templates/ci-dai-gate.yml`). Con los secrets del tracker cargados se saca el
flag y el gate detecta además las US atrasadas.

Mismo criterio dentro del modo completo: si el tracker no responde, **avisa y no
bloquea**. Un gate que se pone rojo porque venció un token enseña al equipo a mirar para
otro lado, y ahí perdimos los dos checks — el de red y el que sí importaba.

### 4. Editar el QUÉ es un comando, y el `spec_version` lo decide la persona

El tercer agujero del mismo origen: **la US vivía en el tracker y no había forma de
editarla sin copiar y pegar.** El PO abría el navegador, escribía en un textarea sin
validación, y el `.md` del repo quedaba viejo — o al revés. Dos comandos, un camino:

```bash
dai edit-us <ID>     # la baja del tracker → $EDITOR → valida → preview → guarda   (PO)
dai update-us <ID>   # ya tenés el .md escrito (lo refinaste implementando) → guarda  (dev)
```

No son dos implementaciones: `edit-us` termina llamando al mismo tramo que `update-us`
(`pushUS`), así que las dos puertas dan **el mismo preview y la misma confirmación**. La
única diferencia es de dónde sale el markdown.

**La validación bloquea tres cosas y avisa del resto.** Frenan: sin título, sin sección
de criterios, sección vacía. Nada más — y no por permisividad: son exactamente las tres
sin las cuales no hay `ac_hash`, y sin `ac_hash` no hay link QUÉ↔CÓMO. Que un criterio no
sea Gherkin completo, o que el título tenga doce palabras, son **avisos**: dai opina en su
dominio (la trazabilidad) y sugiere en el resto. `--strict` sube los avisos a errores para
quien quiera esa política; no es el default, porque un gate que rechaza US legítimas se
esquiva editando en el navegador y volvemos al punto de partida.

Un formato inválido **no tira lo escrito**: te devuelve al editor con los errores a la
vista, tantas veces como haga falta, y salir sin guardar deja tu `.md` intacto.

**El `spec_version` se propone, no se impone.** Si el `ac_hash` se movió, dai pregunta:

| El PO responde | Qué significa | Qué pasa |
|---|---|---|
| `s` | cambio **material** | `v1` → `v2`; los repos con `v1` se marcan atrasados |
| `n` | cambio **editorial** | se queda en `v1`; nadie se marca atrasado |

Es la línea que ya estaba escrita en [METODOLOGIA §4](../METODOLOGIA.md) —*el número
comunica, el hash detecta*— llevada a una pregunta concreta. La máquina sabe **que** algo
cambió; solo la persona sabe **si importa**. Automatizarlo en cualquiera de las dos
direcciones rompe algo: subirlo siempre infla la versión con cada typo y entrena al equipo
a ignorar los ⚠️; no subirlo nunca deja el número mintiendo. `--bump` / `--no-bump` cubren
el caso no interactivo.

## Consecuencias

- `dai stamp` sin argumentos **cambia de comportamiento**: antes estampaba todo, ahora
  estampa una. Es un cambio incompatible en el papel, pero el comportamiento viejo era el
  bug; quien lo quiera tiene `--all`. Va en una **minor** por eso.
- En CI hay que pasar el ID (`dai stamp ABC-482`). `governance/ci-rules.md` lo dice.
- `branch-naming.md` pasa a tener consecuencia mecánica. Un repo con otras convenciones de
  prefijo va a ver ramas "exentas" que él considera de producto — el escape es nombrar la
  rama con el ID, que es lo que `dai link-us` hace solo.
- El gate no valida tests ni lint: eso ya lo hace el CI del repo y dai no se mete
  (ver `dai` como herramienta, no como mandato).
- Los adaptadores de PM ahora devuelven `raw` (el markdown completo de la US) además del
  parseo. Es lo que `edit-us` abre; antes solo teníamos título + hash, que alcanza para
  detectar drift pero no para editar.
- `dai edit-us` le da al **PO** un comando de terminal, cuando hasta ahora su superficie
  eran skills en el asistente y el tracker. Es opcional —seguir editando en el navegador
  funciona igual— pero es el único camino donde el formato se valida ANTES de guardar.
- La validación de formato vive en el CLI (`us-format.mjs`), no en la skill. Es lo
  mecánico y verificable; el criterio de si un criterio es *bueno* sigue en
  `/grill-user-story`, que interroga (ADR-0002).
