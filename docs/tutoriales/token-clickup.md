# Cómo obtener el token de API de ClickUp

Guía paso a paso para generar tu **token de API personal de ClickUp**, necesario para que
`dai` (o cualquier script) se autentique contra la REST API de **ClickUp** cuando el tracker
del repo es ClickUp (`DAI_PM=clickup`).

> **¿Por qué un token y no la contraseña?** ClickUp no permite autenticar la API con la
> contraseña de la cuenta (menos aún con SSO / verificación en dos pasos). El **token
> personal** cumple ese rol: es una credencial que representa a tu usuario y que tratas
> **igual que una contraseña**. Empieza siempre con `pk_`.

**Atajo:** si quieres saltar los pasos 1 y 2, entra directo a
👉 **https://app.clickup.com/settings/apps** (te lleva al paso 3).

---

## Paso 1 — Abre la configuración de tu cuenta

En ClickUp, haz clic en tu **avatar** (arriba a la derecha) y elige **Settings**
(Configuración).

![Menú del avatar → Settings](/tutoriales/clickup-1-settings.png)

---

## Paso 2 — Ve a "API de ClickUp"

En la barra lateral de configuración, bajo tu cuenta, entra a la sección **API de ClickUp**.
Ahí, arriba de todo, verás el bloque **API Token**.

![Barra lateral de Settings → Apps](/tutoriales/clickup-2-api.png)

---

## Paso 3 — Genera o copia el token

En **API Token**:

- Si es la primera vez, haz clic en **Generate** para crearlo.
- Si ya tenías uno, aparece oculto con un botón **Copy** (y un **Regenerate** al lado).

El token empieza con `pk_` (ej. `pk_1234567_ABCDEFG…`). Haz clic en **Copy** para copiarlo.

![Bloque API Token → Generate / Copy](/tutoriales/clickup-3-generate-copy.png)

---

## Paso 4 — Guárdalo en tu `.env.dai`

Pega el token en el `.env.dai` del repo (que **no se versiona**; el `.env` del equipo no se
toca — [ADR-0017](../adr/0017-env-dai.md)), en la variable que espera dai:

```bash
DAI_PM=clickup
DAI_CLICKUP_TOKEN=pk_...        # ← tu token, solo el token (sin comillas ni comentarios al lado)
# DAI_CLICKUP_LIST_ID=          # solo hace falta para `dai publish` (crear tareas)
```

Verifica con `dai doctor` → debería decir **"token de ClickUp presente"**.

---

## Reglas de seguridad (importante)

- 🔒 **Trátalo como una contraseña.** Nunca lo pegues en el código, en un commit, en un chat
  ni en el `implements.yaml`. Solo va en `.env.dai` (no versionado).
- ♻️ **No vence por sí solo** (a diferencia de Jira): queda válido hasta que lo **regeneres**.
  Regenerar crea uno nuevo e **invalida el anterior al instante** — así lo rotas y así cortas
  el acceso de uno filtrado.
- 👤 **Es personal:** representa a tu usuario, con tus permisos. Cada dev usa el suyo, nunca
  uno compartido.
- 🧯 **Si se filtra**, entra a la misma pantalla (paso 3) y haz **Regenerate** de inmediato;
  el viejo deja de funcionar y actualizas el `.env.dai` con el nuevo.
