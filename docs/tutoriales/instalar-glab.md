# Instalar el CLI del forge (`gh` / `glab`) para `dai pr`

`dai pr` crea la Pull/Merge Request usando el **CLI del forge**: `gh` para GitHub, `glab`
para GitLab. dai pushea la rama por **SSH** igual (necesitas las [claves SSH](claves-ssh)),
pero para **crear la PR/MR** hace falta el CLI autenticado.

> **Una vez por máquina.** Instalás el que use tu equipo (o los dos, si trabajás con ambos
> forges). Sin el CLI, `dai pr` **igual pushea la rama** y te dice qué instalar — después
> creás la PR a mano desde la web.

---

## GitHub → `gh`

### Instalar

```bash
brew install gh                 # macOS
winget install GitHub.cli       # Windows
sudo apt install gh             # Debian/Ubuntu (o ver cli.github.com para tu distro)
```

### Autenticar

```bash
gh auth login
```

Elige **GitHub.com**, protocolo **SSH** (o HTTPS), y sigue los pasos. Verifica:

```bash
gh --version
```

---

## GitLab → `glab`

### Instalar

```bash
brew install glab               # macOS · o Linux con Homebrew
winget install GitLab.GLab      # Windows  (alternativa: scoop install glab)
sudo pacman -S glab             # Arch / Manjaro
# Debian/Ubuntu y otras distros: el .deb o el binario de https://gitlab.com/gitlab-org/cli/-/releases
```

### Autenticar

```bash
# GitLab.com:
glab auth login

# GitLab self-hosted / corporativo (el --hostname es OBLIGATORIO):
glab auth login --hostname gitlab.tu-empresa.com
```

Te va a pedir un **token con scope `api`** (lo generás en *GitLab → Preferences → Access
Tokens*). Verifica:

```bash
glab --version
```

---

## Notas

- 🪟 **Windows:** después de instalar con `winget`/`scoop`, **abre una terminal nueva** para
  que tome el PATH; si no, `glab`/`gh` "no se encuentra".
- 🔑 **El CLI usa un token del forge** (no la contraseña, no la clave SSH). Git sigue usando
  SSH; el CLI, token — cada uno lo suyo ([ADR-0007](../adr/0007-modelo-de-autenticacion.md)).
- Con el CLI instalado y autenticado, `dai pr` (o `dai mr` en GitLab) crea la PR/MR
  precargada con la US, el estado de `dai check` y los enlaces.
