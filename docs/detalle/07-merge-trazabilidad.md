# Paso 7 — Merge: la trazabilidad se estampa sola

← vuelve a [`SCRUM-CON-IA.md`](../SCRUM-CON-IA.md)

## En qué consiste en detalle

Al mergear se corre `dai stamp` (el dev en modo distribuido, o el CI si está
automatizado — [ADR-0003](../adr/0003-deteccion-y-estampado-son-comandos.md)). Lee el
`implements.yaml`, compara el hash estampado contra la US viva, y **escribe la
cobertura inversa** en el tracker: qué repo/change implementa la US, contra qué
versión, con estado ✅/⚠️ y links (branch + commit-ancla).

```bash
dai check          # ¿estoy atrasado respecto de la US?  (read-only)
dai check --ci     # el mismo chequeo como GATE del PR: 0 pasa · 1 falta el link · 2 atrasado
dai stamp          # escribe la cobertura en el tracker  (branch + commit)
```

`dai stamp` sin argumentos deduce **qué US** estampar del nombre de tu rama, y si el repo
tiene varias vivas y no puede saberlo, **pregunta** antes de escribir: un comentario en un
tracker no se deshace. **En un pipeline pasá el ID** — `dai stamp ABC-482` — que además es
lo único que un CI sabe con certeza ([ADR-0018](../adr/0018-alcance-de-stamp-y-gate-de-ci.md)).

## Herramientas

- `dai check` / `dai stamp` — mismos comandos los corra un humano o el CI.
- `dai check --ci` — el gate de [`ci-rules.md`](../../governance/ci-rules.md) ejecutable:
  exige el link en las ramas de producto y deja pasar `chore/`, `docs/`, `release/`…
  Workflow listo para copiar: [`templates/ci-dai-gate.yml`](../../templates/ci-dai-gate.yml).
- Contenido del stamp: [ADR-0005](../adr/0005-superficie-comandos-y-stamp.md).

## Qué firma el humano

**Nadie mantiene la matriz a mano** — ese es el punto ([Art. 10](../MANIFIESTO.md#art-10)). El humano a lo sumo
*dispara* `dai stamp`; el contenido lo deriva la máquina.

## Antipatrones

- **Actualizar el estado del ticket a mano** → desincronización garantizada.
- **`dai stamp --all` en el CI** → le deja un comentario a cada US del repo, incluidas las
  de sprints viejos. En un pipeline el ID va explícito.
- **Escribir el link en los dos lados** → se desincroniza al primer cambio (Art. 9).
- **Guardar solo la branch en el stamp** → 404 al borrarse; va con commit-ancla.
- **Creer que hace falta "un CI en Jira"** → es un comando; el tracker no ejecuta nada.
