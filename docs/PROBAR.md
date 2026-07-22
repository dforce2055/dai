# Probar dai

La forma más rápida de conocer dai: instala el CLI y corre el ciclo completo en tu
máquina. Empieza **sin credenciales** (backend `md`) para ver el flujo entero en un par de
minutos, y después pruébalo **contra tu tracker real** (ClickUp o Jira).

> Esto es la guía para **usar** dai por primera vez. Para verlo funcionando sobre una
> US real (narrado), mira [`EJEMPLO-END-TO-END.md`](EJEMPLO-END-TO-END.md).

## Instalar el CLI

```bash
npm i -g @dforce2055/dai
dai --version
```

## Paso 1 — sin credenciales (backend `md`)

Recorre el loop completo `link-us → check → stamp` sin red ni tokens: todo local. Perfecto
para ver cómo funciona antes de conectar nada.

```bash
# 1. Repo de prueba + bootstrap (dai init deja el .env.dai; elige "md" cuando pregunte)
mkdir /tmp/dai-test && cd /tmp/dai-test
git init && git commit --allow-empty -m init
git remote add origin git@github.com:TU-USUARIO/dai-test.git   # para los links de branch/commit
dai init --for both --pm md

# 2. Escribe una US (formato formato-us.md) y publícala con el CLI
cat > draft.md <<'EOF'
# Finalizar la compra del carrito

## Criterios de aceptación
- Dado un carrito vacío, cuando se finaliza, entonces se rechaza
EOF
dai publish draft.md             # crea la US → devuelve el key (con md, un slug)
#   ej: "US publicada en md: finalizar-la-compra-del-carrito"

# 3. El flujo del dev
dai link-us finalizar-la-compra-del-carrito   # branch + implements.yaml
git add -A && git commit -m "feat: guard carrito vacío"
dai check                        # ✅ al día

# 4. La demo del ⚠️: cambia el QUÉ y mira cómo se detecta solo
dai edit-us finalizar-la-compra-del-carrito   # la trae, la abres, valida, pregunta si sube spec_version
dai check                        # ⚠️ ATRASADO (exit 1)  → sugiere: dai link-us <id> --resync

# 5. Estampa la cobertura
dai stamp                        # con md, deja .dai/us/<slug>.coverage.md
```

> En el paso 4, `dai edit-us` abre tu `$EDITOR`. Si no tienes uno configurado te pide
> editar el archivo y volver, así que también funciona con el archivo abierto en tu IDE.
> Agrega un criterio, guarda, y responde `s` a "¿subo spec_version?" para ver el ⚠️.

Con esto ya viste el ciclo entero. Ahora conéctalo a tu tracker real.

## Paso 2 — contra tu tracker real (ClickUp)

**Preparar ClickUp:**

1. **La US:** una tarea con los criterios en la **descripción**, bajo un heading que
   matchee `Criterios de aceptación` (es lo que dai hashea).
2. **El ID:** en la tarea, `...` → *Copy ID* (tipo `86cxyz`).
3. **El token:** ClickUp → *Settings → Apps → Generate* (empieza con `pk_...`).

**Config y flujo:**

```bash
cat > .env.dai <<'EOF'
DAI_PM=clickup
DAI_CLICKUP_TOKEN=pk_XXXXXXXX
EOF
# El link a la tarea lo deduce dai solo. Solo si tu tracker vive en otra URL:
#   DAI_TRACKER_URL_TEMPLATE=https://mi-tracker/t/{id}
dai doctor                       # confirma DAI_PM=clickup y el token

dai link-us 86cxyz               # trae la US de ClickUp → branch + implements.yaml
git add -A && git commit -m "feat: ..."
dai check                        # ✅ al día

# → edita un criterio de la tarea en ClickUp (en el navegador). Después:
dai check                        # ⚠️ ATRASADO (lo detectó solo)
dai stamp                        # deja un COMENTARIO en la tarea con la cobertura

# ¿Editar la US sin salir de la terminal? La trae, la abres, valida y la devuelve:
dai edit-us 86cxyz --dry-run     # el preview completo, sin escribir en ClickUp
```

> El `.env.dai` **no se versiona**: el token no se commitea, y el `.env` del equipo no se
> toca ([ADR-0017](adr/0017-env-dai.md); modelo de auth en [ADR-0007](adr/0007-modelo-de-autenticacion.md)).

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `no encontré la US <id>` | ID mal, o el token no ve esa tarea |
| `clickup 401` | token inválido o expirado |
| `edit-us` dice que la US no tiene el formato mínimo | le falta el `# Título` o la sección `## Criterios de aceptación`. Sin criterios no hay `ac_hash` y no hay link |
| `check` siempre da ⚠️ | editaste la US entre `link-us` y `check` (esperado), **o** los criterios no están bajo el heading `Criterios de aceptación` |
| `sin US` en `check` | la tarea no tiene el bloque de criterios en la descripción |
| branch/commit vacíos en el stamp | falta el remoto git (`git remote add origin …`) |
