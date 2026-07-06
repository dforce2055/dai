# Paso 7 — Merge: la trazabilidad se estampa sola

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## El paso al 100%

Al mergear se corre `dai stamp` (el dev en modo distribuido, o el CI si está
automatizado — [ADR-0003](../adr/0003-deteccion-y-estampado-son-comandos.md)). Lee el
`implements.yaml`, compara el hash estampado contra la US viva, y **escribe la
cobertura inversa** en el tracker: qué repo/change implementa la US, contra qué
versión, con estado ✅/⚠️ y links (branch + commit-ancla).

```bash
dai check   # ¿estoy atrasado respecto de la US?  (read-only, gate de PR)
dai stamp   # escribe la cobertura en el tracker  (branch + commit)
```

## Herramientas

- `dai check` / `dai stamp` — mismos comandos los corra un humano o el CI.
- Contenido del stamp: [ADR-0005](../adr/0005-superficie-comandos-y-stamp.md).

## Qué firma el humano

**Nadie mantiene la matriz a mano** — ese es el punto (Art. 10). El humano a lo sumo
*dispara* `dai stamp`; el contenido lo deriva la máquina.

## Antipatrones

- **Actualizar el estado del ticket a mano** → desincronización garantizada.
- **Escribir el link en los dos lados** → se desincroniza al primer cambio (Art. 9).
- **Guardar solo la branch en el stamp** → 404 al borrarse; va con commit-ancla.
- **Creer que hace falta "un CI en Jira"** → es un comando; el tracker no ejecuta nada.
