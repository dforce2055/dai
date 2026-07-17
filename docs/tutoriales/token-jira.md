# Cómo obtener el token de API de Jira (Atlassian)

Guía paso a paso para generar un **token de API de Atlassian**, necesario para que `dai`
(o cualquier script) se autentique contra la REST API de **Jira Cloud** cuando el tracker
del repo es Jira (`DAI_PM=jira`).

> **¿Por qué un token y no la contraseña?** Jira Cloud no permite autenticar la API con la
> contraseña de la cuenta (menos aún con SSO / verificación en dos pasos). El token cumple
> ese rol: es una credencial revocable, con vencimiento, que tratas **igual que una
> contraseña**.

**Atajo:** si quieres saltar los pasos 1 y 2, entra directo a
👉 **https://id.atlassian.com/manage-profile/security/api-tokens** (te lleva al paso 3).

---

## Paso 1 — Abre la configuración de tu cuenta

En Jira, haz clic en tu **avatar** (arriba a la derecha) y elige **Configuración de la cuenta**.

![Menú del avatar → Configuración de la cuenta](/tutoriales/jira-1-avatar.png)

---

## Paso 2 — Ve a Seguridad → Tokens de API

En la barra superior, entra a la pestaña **Seguridad**. Baja hasta la sección
**Tokens de API** y haz clic en **Crear y gestionar tokens de API**.

![Pestaña Seguridad → Crear y gestionar tokens de API](/tutoriales/jira-2-seguridad-tokens.png)

---

## Paso 3 — Crea el token

Haz clic en **Crear token de API** (el botón simple, no el de "con alcances").
Acceso directo => https://id.atlassian.com/manage-profile/security/api-tokens

![Botón Crear token de API](/tutoriales/jira-3-crear-token.png)

---

## Paso 4 — Nombre y vencimiento

- **Name:** un nombre que describa para qué es (ej. `dai-frontend`, `dai-backend`).
- **Caduca el:** una fecha de vencimiento. Por seguridad, Atlassian **no permite más de un
  año**. Pon la fecha máxima si no quieres renovarlo seguido, o una más corta para rotarlo
  antes.

Haz clic en **Crear**.

![Formulario: Name + fecha de caducidad](/tutoriales/jira-4-nombre-vencimiento.png)

---

## Paso 5 — Cópialo AHORA (no se recupera después)

Atlassian te muestra el token **una sola vez**. Haz clic en **Copiar** y guárdalo en un
lugar seguro. **Si cierras esta ventana sin copiarlo, no hay forma de recuperarlo** —
tendrías que crear uno nuevo.

![Ventana Copia tu token de API](/tutoriales/jira-5-copiar.png)

---

## Reglas de seguridad (importante)

- 🔒 **Trátalo como una contraseña.** Nunca lo pegues en el código, en un commit, en un chat
  ni en el `implements.yaml`. Solo va en `.env` (gitignored).
- ♻️ **Rótalo** periódicamente y **revoca** los que no uses (misma pantalla del paso 3, columna
  *Acción → Revocar*).
- ⏱️ **Vencimiento:** el token deja de funcionar en la fecha que pusiste; anota cuándo renovarlo.
- 🧯 **Si se filtra**, revócalo de inmediato y crea uno nuevo.
