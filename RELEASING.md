# Publicar `dai` en npm

> El nombre corto **`dai` está tomado** en el registry público (placeholder de
> seguridad). Por eso el paquete se publica **scopeado**: `@<tu-usuario>/dai`. El
> **comando sigue siendo `dai`** (lo define el campo `bin`), así que la ergonomía no
> cambia: `npm i -g @<tu-usuario>/dai` y usas `dai …`.

## 1. Confirma el scope

En `package.json`, `"name"` está como **`@dforce2055/dai`** (provisional). Cámbialo por
tu scope real de npm — tiene que coincidir con tu **usuario** o una **org** que
poseas, o el `publish` falla:

```json
"name": "@TU-USUARIO/dai"
```

## 2. Login

```bash
npm login          # una vez por máquina
npm whoami         # confirma que estás logueado
```

## 3. Chequeos previos

```bash
npm test                   # 48 tests (también corre solo en prepublishOnly)
npm pack --dry-run         # revisa QUÉ se publica (sin tests, sin .env)
node cli/dai.mjs --version # dai v0.1.0
```

## 4. Publicar

```bash
npm publish        # `publishConfig.access = public` ya hace público el scopeado
```

Verifica:

```bash
npx @TU-USUARIO/dai --version
npx @TU-USUARIO/dai doctor
```

## 5. Etiquetar la versión (cuando haya remoto git)

```bash
git tag v$(cat VERSION)
git push --tags
```

## 5b. Activar los badges de npm y CI

Están **comentados** en el README (hasta acá no existían el paquete ni el repo → se
verían rotos). Una vez publicado en npm y pusheado a GitHub, des-comenta este bloque
al principio del `README.md` (ajusta el scope si tu usuario npm difiere):

```markdown
[![npm](https://img.shields.io/npm/v/@TU-USUARIO/dai.svg)](https://www.npmjs.com/package/@TU-USUARIO/dai)
[![CI](https://github.com/TU-USUARIO/dai/actions/workflows/ci.yml/badge.svg)](https://github.com/TU-USUARIO/dai/actions/workflows/ci.yml)
```

El de CI se enciende con el primer run del workflow (`git push`); el de npm, con el
primer `npm publish`.

## 6. Próxima versión

Sube `VERSION` **y** `package.json`→`version` juntos (semver), y repite desde el
paso 3. Regla: cambio de comportamiento del CLI o del protocolo → *minor*; fix →
*patch*; ruptura del contrato (`ac_hash`, schema del `implements.yaml`) → *major*.

## Qué NO se publica

Lo controla `files` en `package.json` (allowlist): quedan afuera `cli/test/`, el
`.env`, y cualquier cosa no listada. Los secretos nunca salen (ADR-0007).
