# Claves SSH para GitHub y GitLab

Guía para generar tu **clave SSH** y registrarla en GitHub y/o GitLab. En dai, **git usa
SSH** (clonar, `push`, `pull`); los tokens son solo para el forge y el tracker, y **nunca**
se usa la contraseña ([ADR-0007](../adr/0007-modelo-de-autenticacion.md)). Con la clave
configurada, `dai pr` puede pushear la rama sin pedirte credenciales.

> **Una vez por máquina.** La misma clave sirve para GitHub y GitLab (y para todos tus
> repos). No necesitas una por proyecto.

---

## Paso 1 — ¿Ya tienes una clave?

```bash
ls ~/.ssh/id_ed25519.pub
```

Si el archivo existe, ya tienes clave: salta al **Paso 4**. Si dice *"No such file"*, sigue
con el paso 2.

---

## Paso 2 — Genera la clave

```bash
ssh-keygen -t ed25519 -C "tu-correo@ejemplo.com"
```

- Usa el correo de tu cuenta de GitHub/GitLab.
- Cuando pregunte la ubicación, acepta la default (Enter).
- La *passphrase* es opcional pero recomendada (una contraseña que protege la clave).

> Si tu sistema es viejo y no soporta `ed25519`, usa `-t rsa -b 4096`.

---

## Paso 3 — Carga la clave en el agente SSH

```bash
eval "$(ssh-agent -s)"        # inicia el agente
ssh-add ~/.ssh/id_ed25519     # carga tu clave (pide la passphrase si pusiste una)
```

> **Windows:** usa **Git Bash** para estos comandos, o habilita el servicio *OpenSSH
> Authentication Agent* de Windows.

---

## Paso 4 — Copia la clave **pública**

Nunca compartas la privada (`id_ed25519`). Copia solo la **pública** (`.pub`):

```bash
cat ~/.ssh/id_ed25519.pub        # muestra la clave; copiala entera (empieza con "ssh-ed25519")
# atajos: macOS → | pbcopy   ·   Windows (Git Bash) → | clip   ·   Linux → | xclip -sel clip
```

---

## Paso 5 — Pégala en GitHub y/o GitLab

- **GitHub:** *Settings → SSH and GPG keys → New SSH key*. Pega la clave, ponle un título
  (ej. `laptop-trabajo`) y guarda.
  Acceso directo: **https://github.com/settings/ssh/new**
- **GitLab:** *Preferences → SSH Keys → Add new key*. Pega la clave y guarda. En un GitLab
  **self-hosted/corporativo** entra por la URL de tu instancia
  (`https://gitlab.tu-empresa.com/-/user_settings/ssh_keys`).

---

## Paso 6 — Prueba la conexión

```bash
ssh -T git@github.com
# → "Hi <usuario>! You've successfully authenticated..."

ssh -T git@gitlab.com
# (self-hosted: ssh -T git@gitlab.tu-empresa.com)
```

La primera vez te pregunta si confías en el host: escribí `yes`. Si ves el saludo con tu
usuario, quedó lista.

---

## Reglas de seguridad

- 🔒 **La clave privada nunca sale de tu máquina.** No la pegues en ningún lado, no la
  commitees, no la mandes por chat. Solo se registra la **pública** (`.pub`).
- 🧯 **Si se compromete tu máquina**, borra la clave pública de GitHub/GitLab (misma
  pantalla del paso 5) y generá una nueva.
- 👤 Es **por máquina y por persona**: cada dev tiene la suya.
