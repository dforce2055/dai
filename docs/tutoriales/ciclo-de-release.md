# Ciclo de release, paso a paso

De "hay cosas para sacar" a "producción sabe qué versión tiene y cada User Story lo dice".
Unos 15 minutos la primera vez.

El *porqué* de todo esto está en la [guía de releases](../guias/releases). Acá van los
comandos.

> **Lo hace la persona, no el agente.** dai prepara, muestra y confirma; mergear, publicar y
> desplegar los firmas tú. Si prefieres que un asistente te acompañe paso a paso, invoca la
> skill `/dai-release` — usa exactamente estos comandos y frena en las mismas firmas.

## Antes de empezar

Declara las dos ramas de vida larga de tu repositorio en el `.env.dai`. Es lo único que
tienes que configurar, y se hace una sola vez:

```bash
# .env.dai  (no se versiona)
DAI_BRANCH_DEV=develop     # la rama que integra el desarrollo
DAI_BRANCH_PROD=main       # la rama que despliega a producción
```

Comprueba que dai las ve:

```bash
dai release status
```

```
› versión declarada: 0.4.2  (VERSION)
› último tag: v0.4.2
⚠ 'develop' tiene 6 commit(s) sin promover · 3 US · bump propuesto: minor.
    Ver el detalle:  dai release plan
```

Si dice que falta un *back-merge* de la versión anterior, resuélvelo antes de seguir: cortar
una versión sobre otra a medio cerrar arrastra el problema.

## Paso 1 · Qué entra — `dai release plan`

```bash
dai release plan
```

```
  ── Release a preparar ────────────────────────────────
  desde:    v0.4.2
  hasta:    develop
  cambios:  6 commit(s) · 5 merge(s)
  versión:  0.4.2 → 0.5.0  (minor)
  ─────────────────────────────────────────────────────
  User Stories que entran (3):
    ✅ ACME-482  v2  Checkout sin duplicado
    ⚠️  ACME-491  v1  Alta de póliza sin duplicar cliente
                  ATRASADA
    ✅ ACME-503  v3  Recordar medio de pago

  ⚠ 1 US ATRASADA(S): el QUÉ cambió después de implementarlo.
    Esta release las llevaría sin cubrir el criterio nuevo. Revisalas antes de cortar.

  Sin US, por tipo de branch (1): chore/deps

  ⚠ 1 branch(es) sin US y sin prefijo exento:
      arreglo-rapido
```

**Esta es la pantalla importante del ciclo.** Léela entera antes de seguir:

- **US atrasadas** — alguien cambió los criterios de aceptación después de que se
  implementaran. Puedes cortar igual (a veces el criterio nuevo va en la próxima versión),
  pero que sea una decisión y no un descuido.
- **Ramas sin US y sin prefijo exento** — entró trabajo que nadie va a poder rastrear a una
  historia. Es la última oportunidad de verlo.

Con `--json` sale el mismo manifiesto estructurado, para scripts o para un asistente.

## Paso 2 · La versión — la firmas tú

dai **propone** un piso mirando los tipos de commit y lo dice:

```
  minor: 3 commit(s) feat: agregan funcionalidad
  propuesta a partir de los TIPOS de commit — la regla del repo mira el COMPORTAMIENTO.
```

La regla que manda mira el **comportamiento observable**: si algo mueve un valor por
omisión, agrega una opción o cambia lo que ve quien no configura nada, es *minor* aunque
todos los commits digan `fix:`. Esa decisión es tuya.

## Paso 3 · Cortar — `dai release cut`

```bash
dai release cut 0.5.0
```

Crea la rama `release/0.5.0`, sube el número en los archivos que tu repositorio espeja,
escribe la entrada del CHANGELOG y hace el commit. **No habla hacia afuera**: no hay *push*,
ni tag, ni PR.

```
✓ branch release/0.5.0
✓ VERSION: 0.4.2 → 0.5.0
✓ package.json: 0.4.2 → 0.5.0
✓ CHANGELOG.md: entrada para 0.5.0
✓ commit chore(release): v0.5.0
```

> ¿Tu repositorio no tiene `VERSION` ni `package.json`? No pasa nada: el tag es la versión y
> dai te lo dice. ¿Trabajas sin rama de release, etiquetando directamente desde integración?
> Usa `--no-branch`.

## Paso 4 · El CHANGELOG — lo escribes tú

dai deja el material y las secciones vacías:

```markdown
## [0.5.0] — 2026-09-09

<!-- dai:manifiesto · el material de esta versión. Repartilo abajo y contá el porqué:
     dai sabe qué entró; por qué importa lo sabés vos.
     ACME-482  Checkout sin duplicado
     ACME-491  Alta de póliza sin duplicar cliente
-->

### Agregado
### Cambiado
### Corregido
### Interno
```

Reparte las historias en las secciones que correspondan, **explica por qué importaba cada
una** y borra el comentario. Un changelog que solo lista lo que entró no lo lee nadie; uno
que cuenta qué estaba mal se lee seis meses después.

Luego, el commit y la PR:

```bash
git add CHANGELOG.md && git commit -m "docs(changelog): reparte el manifiesto de la 0.5.0"
dai pr --description-file notas.md
```

La base sale sola: una rama `release/` va contra tu rama de producción, y dai te lo marca y
te pide que escribas el nombre de la rama para confirmar.

## Paso 5 · Merge y publicación — tu firma

Apruebas y mergeas la PR, y ejecutas lo que tu repositorio use para publicar (`npm publish`,
un despliegue, lo que sea). **El ciclo no terminó acá**: faltan el tag, la nota de release y
el *back-merge* — los tres pasos que más se olvidan cuando esto se hace de memoria.

## Paso 6 · Cerrar — `dai release done`

```bash
dai release done 0.5.0
```

```
  ── Cerrar la versión 0.5.0 ──────────────────────────
  tag:      v0.5.0 → main @ 177719f3
  release:  nota en el forge
  back-merge: main → develop
  aviso:    webex · webexapis.com
  ─────────────────────────────────────────────────────
✓ tag v0.5.0 creado y publicado
✓ release note publicada
✓ back-merge main → develop
```

Y borra la rama `release/0.5.0` (local y remota): ya está mergeada, etiquetada y con el
back-merge hecho, así que no tiene más razón de existir — una rama de release que sobrevive
a su release es un fork. Si quieres conservarla, `--keep-branch`. Si git se niega a
borrarla, es porque tiene commits que no llegaron a producción: revísala.

Cada paso se reporta por separado a propósito: **una vez creado el tag, la versión existe**.
Si falla la nota de release, dai te lo dice y aclara que el tag ya está publicado, para que
completes solo lo que falta.

## Paso 7 · Estampar el despliegue — opcional

Cuando la versión llega a un ambiente:

```bash
dai release stamp 0.5.0 --env prod --app acme-backend
```

```
  ── Estampar despliegue ───────────────────────────────
  versión:  v0.5.0     app: acme-backend     ambiente: PROD
  tracker:  jira · 3 User Storie(s) en el release
  ─────────────────────────────────────────────────────
    ACME-482  Checkout sin duplicado
    ACME-491  Alta de póliza sin duplicar cliente
    ACME-503  Recordar medio de pago
  ─────────────────────────────────────────────────────
⚠ esto escribe 3 comentario(s) en el tracker de todo el equipo. No se deshace.
  ¿Estampo 3 comentario(s)? (s/N)
```

Cada User Story recibe un comentario con versión, aplicación, ambiente y fecha. Desde ese
momento, el funcional abre el ticket y sabe dónde está su historia sin preguntar. Si una US
se implementa en varios repositorios, el ticket va acumulando la matriz: *backend en
producción, frontend en pre*.

**Es opcional.** Decir que no sale con código 0 y no rompe nada: la versión ya está hecha.
Si tu equipo prefiere no llenar los tickets, avisa solo al canal.

Volver a ejecutarlo **no duplica**: dai reconoce sus propios comentarios por
`(aplicación, versión, ambiente)` y saltea los que ya están. La misma versión en otro
ambiente sí es un evento nuevo y se estampa.

## Paso 8 · El aviso al equipo — opcional

Si declaras un canal, `done` y `stamp` avisan solos:

```bash
# .env.dai
DAI_NOTIFY=webex               # discord | slack | webex | telegram | webhook | none
DAI_NOTIFY_WEBHOOK=https://…   # SECRETO: quien lo tiene, puede publicar
```

Antes de depender de él, pruébalo:

```bash
dai release notify --test
```

El mensaje que sale es siempre el mismo, en cualquier canal:

```
🚀 Release desplegada · acme-backend v0.5.0 → PROD
Autor: Ada Lovelace · Fecha: 09/09/2026 09:15

Cambios principales:
 • ACME-482  Checkout sin duplicado
 • ACME-491  Alta de póliza sin duplicar cliente
 • ACME-503  Recordar medio de pago

Ver release: https://…/releases/v0.5.0
```

Las viñetas son las **User Stories**, no los commits: lo que el equipo quiere leer es qué
valor salió, no qué archivos se tocaron.

## El ciclo entero, resumido

```bash
dai release status                        # ¿dónde estoy?
dai release plan                          # ¿qué entra?  ← la pantalla importante
dai release cut 0.5.0                     # rama + número + CHANGELOG + commit
# … escribes el CHANGELOG …
dai pr                                    # PR a producción (te pide confirmación)
# … mergeas y publicas: tu firma …
dai release done 0.5.0                  # tag + nota + back-merge + aviso
dai release stamp 0.5.0 --env prod        # opcional: avisar a cada US
```

## Si algo sale mal

| Síntoma | Qué hacer |
|---|---|
| `no existe el tag vX.Y.Z` al estampar | Cierra la versión primero (`dai release done`), o trae los tags con `git fetch --tags`. |
| `done` creó el tag pero falló la nota | El tag ya está: la versión existe. Publica la nota a mano con el comando que dai te deja impreso. |
| El manifiesto no muestra ninguna US | ¿Las ramas tenían `implements.yaml`? Sin link no hay trazabilidad que reportar. |
| El tracker no responde | `dai release plan --no-network` sale igual, avisando que no pudo verificar. |
| Salieron comentarios repetidos | dai no pudo leer los comentarios previos y lo avisó. Revisa el token del tracker. |
