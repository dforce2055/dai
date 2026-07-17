# ADRs — decisiones de fondo de la metodología

Registro de las decisiones estructurales de `dai`. Cada ADR es **inmutable**: si una
decisión cambia, se escribe un ADR nuevo que supersede al viejo. Molde en
[`templates/adr.md`](../../templates/adr.md).

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-contrato-ac-hash.md) | El contrato del `ac_hash` (normalización + SHA-256, tres momentos) | aceptado |
| [0002](0002-agnostico-del-asistente.md) | La metodología es agnóstica del asistente (Claude / Copilot) | aceptado |
| [0003](0003-deteccion-y-estampado-son-comandos.md) | La detección y el estampado son comandos (`dai check` / `dai stamp`), no infraestructura | aceptado |
| [0004](0004-ubicacion-y-schema-implements.md) | Ubicación (co-localizado + glob) y schema del `implements.yaml` | aceptado |
| [0005](0005-superficie-comandos-y-stamp.md) | Superficie de comandos (`ls`/`check`/`stamp`) y contenido del stamp (branch + commit-ancla) | aceptado |
| [0006](0006-distribucion-y-licencia.md) | Distribución (npm + fallback) y licencia (GPLv3) | aceptado |
| [0007](0007-modelo-de-autenticacion.md) | Modelo de auth: SSH para git, tokens scopeados para forge/tracker, sin contraseñas | aceptado |
| [0008](0008-estrategia-de-i18n.md) | Estrategia de i18n: fuente única (español) + traducciones derivadas, `DAI_LANG` en el CLI, por fases | propuesto |
| [0009](0009-adaptador-cursor.md) | Adaptador nativo para Cursor (skills + rules) con `dai init`/`install`/`doctor` | propuesto |
| [0010](0010-versionado-y-upgrade.md) | Versionado y upgrade: compatibilidad por semver, `doctor` version-drift, `dai sync` aditivo | propuesto |
| [0011](0011-archive-gate-de-aprobacion.md) | `archive` es un gate de aprobación: `dai archive` (comando) lo corre el aprobador; `check`/`ls` saltean `archive/` | aceptado |
| [0012](0012-upgrade-self-update-del-cli.md) | `dai upgrade`: self-update del CLI + `dai sync` del scaffold | aceptado |
| [0013](0013-skills-externas-install-from.md) | `dai skills install --from`: skills externas por-stack, sin registro ni gatekeeping | aceptado |
| [0014](0014-copilot-agent-skills.md) | Copilot lee `SKILL.md` nativo (Agent Skills): se elimina el adaptador `.prompt.md` — modifica la 0002 | aceptado |
| [0015](0015-jira-corporativo.md) | `dai publish` en Jira corporativo: campos propios declarados, `--parent`/`--issuetype`, TLS con CA (nunca apagar la verificación) | aceptado |
| [0016](0016-review-inline.md) | Review inline: `review.json` como contrato y puerta humana, el CLI valida las posiciones contra el diff, `--yes` explícito, nunca `APPROVE` | aceptado |

> Estas son las decisiones que cierran las "Decisiones abiertas" de
> [`METODOLOGIA.md §7`](../METODOLOGIA.md) y las enmiendas al
> [`MANIFIESTO.md`](../MANIFIESTO.md).
