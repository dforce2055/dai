# Probar dai

No hace falta publicar en npm para probarlo. Se prueba local. Recomendado: hacer la
**Fase 0** (backend `md`, sin credenciales) para validar el flujo, y después la
**Fase 1** (ClickUp real).

> Esto es la guía para **usar** dai por primera vez. Para verlo funcionando sobre una
> US real (narrado), mirá [`EJEMPLO-END-TO-END.md`](EJEMPLO-END-TO-END.md).

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
# 1. Repo de prueba + bootstrap
mkdir /tmp/dai-test && cd /tmp/dai-test
git init && git commit --allow-empty -m init
git remote add origin git@github.com:TU-USUARIO/dai-test.git   # para los links de branch/commit
dai init --for both

# 2. Config para md
printf 'DAI_PM=md\nDAI_MD_US_DIR=.dai/us\n' > .env

# 3. La US como .md local (criterios bajo el heading exacto)
mkdir -p .dai/us
cat > .dai/us/US-1.md <<'EOF'
spec_version v1

# Finalizar la compra del carrito

## Criterios de aceptación
- Dado un carrito vacío
- Cuando se finaliza
- Entonces se rechaza
EOF

# 4. El flujo
dai link-us US-1                 # branch + implements.yaml (trae la US del backend)
git add -A && git commit -m "feat: guard carrito vacío"
dai check                        # ✅ al día

# 5. La demo del ⚠️: editá un criterio en .dai/us/US-1.md y volvé a chequear
dai check                        # ⚠️ ATRASADO (exit 1)
dai stamp                        # con md, deja .dai/us/US-1.coverage.md
```

Si esto anda, el flujo está bien. Pasá al tracker real.

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

# → editá un criterio de la tarea en ClickUp (en el navegador). Después:
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
