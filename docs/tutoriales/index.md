# Tutoriales

Guías de **setup operativo** — lo que haces una vez por máquina para trabajar con dai.

## De cero a publicar

- [**Setup para analistas funcionales y PMs (Windows)**](./setup-funcional) — el camino
  completo sin git ni repositorio: Node, dai, las skills en Copilot, el token de Jira y una
  épica + US de prueba publicadas de verdad.

## Preparar el entorno

- [**Configurar git**](./configurar-git) — tu identidad (nombre + correo) para que los
  commits te atribuyan.
- [**Claves SSH**](./claves-ssh) — generar y registrar tu clave en GitHub / GitLab. En dai,
  git usa SSH ([ADR-0007](../adr/0007-modelo-de-autenticacion.md)).
- [**Instalar gh / glab**](./instalar-glab) — el CLI del forge, para que `dai pr` cree la
  PR/MR.

## Conectar el tracker

- [**Token de Jira**](./token-jira) — generar tu token de API de Atlassian (`DAI_PM=jira`).
- [**Token de ClickUp**](./token-clickup) — generar tu token personal de ClickUp
  (`DAI_PM=clickup`).
