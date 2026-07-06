# Probar dai

No hace falta publicar en npm para probarlo. Se prueba local. Recomendado: hacer la
**Fase 0** (backend `md`, sin credenciales) para validar el flujo, y después la
**Fase 1** (ClickUp real).

> Esto es la guía para **usar** dai por primera vez. Para verlo funcionando sobre una
> US real (narrado), mira [`EJEMPLO-END-TO-END.md`](EJEMPLO-END-TO-END.md).

## Instalar el CLI

```bash
npm i -g @dforce2055/dai        # desde npm
# — o, si clonaste el repo —
git clone https://github.com/dforce2055/dai && cd dai && npm link

dai --version
```

## Fase 0 — sin credenciales (backend `md`)

Valida el loop completo `link-us → check → stamp` sin depender de red ni tokens.

```bash
# 1. Repo de prueba + bootstrap (dai init deja el .env; elige "md" cuando pregunte)
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

# 4. La demo del ⚠️: edita el criterio en .dai/us/<slug>.md y vuelve a chequear
dai check                        # ⚠️ ATRASADO (exit 1)  → sugiere: dai link-us <id> --resync
dai stamp                        # con md, deja .dai/us/<slug>.coverage.md
```

Si esto anda, el flujo está bien. Pasa al tracker real.

## Fase 1 — ClickUp real

**Preparar ClickUp:**

1. **La US:** una tarea con los criterios en la **descripción**, bajo un heading que
   matchee `Criterios de aceptación` (es lo que dai hashea).
2. **El ID:** en la tarea, `...` → *Copy ID* (tipo `86cxyz`).
3. **El token:** ClickUp → *Settings → Apps → Generate* (empieza con `pk_...`).

**Config y flujo:**

```bash
cat > .env <<'EOF'
DAI_PM=clickup
DAI_CLICKUP_TOKEN=pk_XXXXXXXX
DAI_TRACKER_URL_TEMPLATE=https://app.clickup.com/t/{id}
EOF
dai doctor                       # confirma DAI_PM=clickup y el token

dai link-us 86cxyz               # trae la US de ClickUp → branch + implements.yaml
git add -A && git commit -m "feat: ..."
dai check                        # ✅ al día

# → edita un criterio de la tarea en ClickUp (en el navegador). Después:
dai check                        # ⚠️ ATRASADO (lo detectó solo)
dai stamp                        # deja un COMENTARIO en la tarea con la cobertura
```

> El `.env` está gitignored: el token no se commitea (ADR-0007).

## Troubleshooting

| Síntoma | Causa probable |
|---|---|
| `no encontré la US <id>` | ID mal, o el token no ve esa tarea |
| `clickup 401` | token inválido o expirado |
| `check` siempre da ⚠️ | editaste la US entre `link-us` y `check` (esperado), **o** los criterios no están bajo el heading `Criterios de aceptación` |
| `sin US` en `check` | la tarea no tiene el bloque de criterios en la descripción |
| branch/commit vacíos en el stamp | falta el remoto git (`git remote add origin …`) |
