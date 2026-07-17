# ADR-0006 — Distribución y licencia

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** autor / mantenedor

## Contexto

`dai` va a distribuirse para que **la comunidad lo use y lo mejore**. Hay que fijar
dos cosas: bajo qué **licencia** se libera, y por qué **canales** se distribuye. El
CLI es Node **cero dependencias**, lo que abre canales que no todos los proyectos
tienen (correr sin `npm install`).

## Decisión

### Licencia: GPLv3 (`GPL-3.0-or-later`)

El objetivo es *libre + que la comunidad ayude a mejorarla*. La garantía **legal**
más fuerte de eso es el **copyleft**: quien distribuya un `dai` modificado debe
publicar sus cambios bajo la misma licencia. La GPL convierte "las mejoras vuelven"
en cláusula, no en deseo.

El downside típico de la GPL **no aplica** aquí: `dai` es un **CLI que se ejecuta**,
no una librería que se embebe. Usar `dai` sobre tu código —aunque sea propietario y
comercial— **no genera ninguna obligación**; el copyleft solo se activa si alguien
**forkea y redistribuye** una versión modificada. Y *libre ≠ gratis*: se puede
cobrar por uso, soporte o desarrollo sobre `dai`.

- SPDX: **`GPL-3.0-or-later`** (recomendación FSF: "v3 o posterior"). Si se prefiere
  fijar solo v3, cambiar a `GPL-3.0-only`.
- El texto íntegro va en `LICENSE` (copia verbatim de gnu.org).
- Los **docs/metodología** quedan cubiertos por la misma licencia por ahora; a
  futuro podrían migrar a **CC BY-SA** (el copyleft equivalente para texto).

### Distribución

- **npm público** como canal principal (el CLI es cero-dep → `npx dai …` anda sin
  instalar nada).
- **git-clone + `install.sh`** y **tarball** como fallback para **redes corporativas
  cerradas** (proxy/firewall que bloquea el registry).
- Se saca `"private": true` del `package.json` para habilitar la publicación.

## Consecuencias

- ✅ Los forks públicos de `dai` quedan abiertos para siempre → el commons crece.
- ✅ Cualquier empresa puede *usar* `dai` sin obligaciones (es un CLI).
- ✅ El canal cero-dep + fallback cubre tanto factories abiertas como orgs cerradas.
- ⚠️ `dai` no se podrá **embeber** como librería dentro de software propietario. Si
  alguna vez hace falta eso, se evaluaría relicenciar una parte como LGPL/MIT.
- ⚠️ Publicar en npm hace el código **público** — nada de secretos en el repo (ya lo
  cubre `.gitignore` + `.env`).

## Alternativas consideradas

- **MIT / Apache-2.0 (permisivas)** — máxima adopción y fricción cero, pero **no**
  obligan a devolver mejoras: se depende de la buena voluntad. Descartadas frente al
  objetivo explícito de "que la comunidad ayude a mejorarla".
- **AGPLv3** — extiende el copyleft al uso como servicio en red. Overkill para un CLI
  local; se descarta salvo que aparezca un caso SaaS.
