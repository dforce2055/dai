# Convención de naming de ramas

> El nombre de la rama **es** el primer eslabón del link. Si es inconsistente, la
> trazabilidad se rompe desde el commit uno. Por eso lo genera `link-us`, no la mano.

## El formato

```
feature/ABC-###-<slug>
└──┬──┘ └──┬───┘ └─┬─┘
   │       │       └ título de la US, minúsculas, sin acentos, guiones como separador
   │       └ ID de la US en el gestor (identidad estable del QUÉ)
   └ tipo de rama
```

Ejemplo: `feature/ABC-482-finalizar-compra-sin-duplicado`

## Reglas

- El **ID nunca se tipea a mano**: sale del argumento de `/link-us ABC-###`. Elimina
  el error de tipeo que rompe el link ([Art. 8](../docs/MANIFIESTO.md#art-8), Art. 9).
- El **slug** deriva del título de la US: minúsculas, sin acentos ni ñ, espacios → `-`.
- La **base** de una PR no se recuerda ni se configura una por una: sale del **tipo de
  rama**, leyendo las dos ramas de vida larga que el repo declara en su `.env.dai`.

  | Tipo de rama | PR contra | Variable |
  |---|---|---|
  | `feature/`, `fix/`, el resto | la rama que integra | `DAI_BRANCH_DEV` |
  | `release/`, `hotfix/` | la rama que despliega a producción | `DAI_BRANCH_PROD` |

  `dai pr` y `dai done` usan ese mapa; `--base` siempre gana. Si `DAI_BRANCH_DEV` no está
  declarada, dai usa la rama default del remoto y **avisa que la está adivinando**.
- Apuntarle a `DAI_BRANCH_PROD` pide una **confirmación explícita**: hay que escribir el
  nombre de la rama, y con `--yes` hace falta `--to-prod`. En repos con ramas de ambiente
  (`testing` integra, `main` va a producción) esto es lo que evita que una PR quede
  proponiendo un despliegue que nadie pidió. Sin la variable declarada, dai no marca
  ninguna rama como producción: no adivina cuál es.
- Una rama, una US. Si una US toca varios repos, es una rama por repo, **todas con el
  mismo `ABC-###`** — así el índice las agrupa en una fila (federación).

## Tipos de rama (opcional, por repo)

| Prefijo | Para |
|---|---|
| `feature/` | nueva capacidad (el caso por defecto) |
| `fix/` | corrección sobre una US ya implementada |
| `chore/` | trabajo sin US (tooling, deps) — sin `implements`, no cuenta para cobertura |

> Regla de oro: si la rama implementa una US, **su nombre lleva el ID** y existe
> `implements.yaml`. Si no lleva ID, no es trabajo de producto y el CI no le exige link.
