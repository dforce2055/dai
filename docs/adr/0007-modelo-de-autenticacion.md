# ADR-0007 — Modelo de autenticación

- **Estado:** aceptado
- **Fecha:** 2026-07-03
- **Decide:** lead / arquitecto + mantenedor

## Contexto

`dai` y sus skills tocan **tres** sistemas externos: los repos de código (git), el
forge (GitHub/GitLab, para comentar PRs), y el tracker (Jira/ClickUp). Cada uno se
autentica distinto. Ahora que hay tokens en juego (`dai forge`, adaptador de PM),
hay que fijar un modelo de auth **antes** de seguir sumando credenciales — para no
terminar con contraseñas hardcodeadas o secretos en un commit.

Principio rector: **least privilege, sin contraseñas, secretos nunca versionados.**

## Decisión

### Tres credenciales, tres mecanismos (no se mezclan)

| Sistema | Acción | Credencial | Dónde vive |
|---|---|---|---|
| **git** | clone / fetch / push | **SSH key** (ssh-agent) | `~/.ssh` — **nunca** en `.env` ni en el repo |
| **forge** | leer/comentar PR/MR | **token scopeado** (`GITHUB_TOKEN` / `GITLAB_TOKEN`) | `.env` (gitignored) o secret store del CI |
| **tracker** | leer/escribir US y cobertura | **api_key** (`DAI_JIRA_TOKEN` / `DAI_CLICKUP_TOKEN`) | `.env` o secret store del CI |

### Reglas

1. **Nada de contraseñas.** Ni para git (SSH), ni para las APIs (tokens scopeados y
   revocables). Prohibido el patrón `https://user:password@host`.
2. **git es SSH.** El transporte de git (incluido lo que haga un agente o el CLI)
   usa SSH. Comentar una PR **no** se hace por SSH (SSH solo mueve objetos git): eso
   es API del forge → token.
3. **Least privilege.** El token del forge se limita al scope mínimo (PRs/notes), no
   un PAT con acceso total. Igual para el tracker.
4. **Secretos fuera del repo.** Solo en `.env` (gitignored) o el secret store del CI.
   Nunca en el código, ni en `implements.yaml`, ni en un commit. `.env.example`
   documenta los **nombres** de las variables, jamás los valores.
5. **Dos caras (ADR-0002).** Las **skills** usan el **MCP** del asistente (que guarda
   sus propias credenciales); el **CLI** usa los **tokens del `.env`**. Nunca se
   comparten ni se filtra uno al otro.
6. **Variables de entorno ganan.** Un token exportado en la shell/CI pisa al `.env`
   (para que el CI inyecte secretos sin escribir archivos).

## Consecuencias

- ✅ Superficie de secretos mínima y auditable: SSH keys + tokens scopeados, cero
   contraseñas.
- ✅ `.gitignore` + `.env.example` ya hacen cumplir "secretos fuera del repo".
- ✅ Rotar/revocar es trivial: son tokens, no contraseñas de cuenta.
- ⚠️ Requiere que cada dev tenga su SSH key configurada (ssh-agent) — es el costo de
   no usar contraseñas. Se documenta en el onboarding.
- ⚠️ En el CI hay que cargar los tokens desde su secret store, no desde un `.env`
   commiteado (que no existe).

## Alternativas consideradas

- **Contraseña / PAT embebido en la URL de git** — descartado: viola "sin
   contraseñas", y termina en el `~/.git-credentials` o en un remoto commiteado.
- **Un único super-token para todo** — descartado: rompe least privilege; si se
   filtra, se filtra todo. Un token por sistema y por scope.
- **Que el CLI use el MCP del asistente** — imposible: el CLI corre standalone, no
   tiene acceso al MCP. Por eso el CLI usa tokens propios (dos caras).
