# Configurar tu identidad de git

Antes de tu primer commit, git necesita saber **quién sos**: cada commit lleva un nombre y
un correo de autor. Sin configurarlo, los commits salen con un autor vacío o incorrecto, y
en dai la **autoría siempre es de una persona** — nunca de un bot.

> **Una vez por máquina.** Con `--global` queda para todos tus repos.

---

## Paso 1 — Nombre y correo

```bash
git config --global user.name "Nombre Completo"
git config --global user.email "tu-correo@ejemplo.com"
```

> **Usa el mismo correo que tu cuenta de GitHub/GitLab.** Así el forge te **atribuye** los
> commits (aparecen con tu avatar y cuentan en tu actividad). Si el correo no coincide, los
> commits quedan "huérfanos", sin vincularse a tu cuenta.

---

## Paso 2 — Verifica

```bash
git config --global user.name       # → Nombre Completo
git config --global user.email      # → tu-correo@ejemplo.com
git config --global --list          # ve toda la config global
```

---

## Un correo distinto para un repo puntual

Si en un repo específico quieres usar otra identidad (ej. trabajo vs. personal), configúralo
**sin** `--global`, dentro de ese repo:

```bash
cd mi-repo
git config user.email "correo-de-este-repo@ejemplo.com"
```

La config del repo **gana** sobre la global, solo ahí.

---

## Por qué importa en dai

- **Trazabilidad de autoría:** dai ata el QUÉ al CÓMO, y el CÓMO lo firma una persona. Un
  commit con autor mal seteado rompe esa cadena.
- **El review sale a tu nombre:** cuando `dai-review` postea con tu token, el forge lo
  atribuye a **ti** — tener bien tu identidad es parte de responder por lo que firmas.
