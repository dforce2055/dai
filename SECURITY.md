# Política de seguridad

## Reportar una vulnerabilidad

Si encuentras un problema de seguridad, **no abras un issue público**. Escribe a
**dperez2055@gmail.com** con:

- Descripción del problema y su impacto.
- Pasos para reproducirlo.
- Versión afectada (`dai --version`).

Vas a recibir acuse de recibo. Se coordina la corrección y la divulgación una vez que
haya un fix disponible.

## Modelo de seguridad de dai

- **Sin secretos en el repo.** Los tokens viven en `.env` (gitignored) o en el secret
  store del CI, nunca versionados. Solo se versiona `.env.example` (nombres, no
  valores). Ver [ADR-0007](docs/adr/0007-modelo-de-autenticacion.md).
- **Sin contraseñas.** git usa **SSH**; forge y tracker usan **tokens scopeados** y
  revocables, con el mínimo scope necesario.
- **Cero dependencias de runtime.** No hay árbol de dependencias transitivas que
  auditar ni por el que entren vulnerabilidades. El CLI usa solo la stdlib de Node.
- **Sin ejecución de shell con input del usuario.** Las llamadas a git usan
  `execFileSync` con argumentos como array (no `shell: true`), evitando inyección.

## Buenas prácticas para quien usa dai

- Usa **tokens de mínimo scope** (para comentar PRs alcanza con permiso de
  pull-requests/notes; no un PAT de acceso total).
- **Rota** los tokens periódicamente y revoca los que no uses.
- Nunca pegues un token en el código, en un commit, ni en el `implements.yaml`.
- Revisa qué se publica antes de un release: `npm pack --dry-run`.

## Versiones soportadas

Se da soporte a la última versión publicada. Actualiza antes de reportar.
