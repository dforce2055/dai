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

> Estas son las decisiones que cierran las "Decisiones abiertas" de
> [`METODOLOGIA.md §7`](../METODOLOGIA.md) y las enmiendas al
> [`MANIFIESTO.md`](../MANIFIESTO.md).
