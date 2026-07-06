# Guía del lead / Scrum Master / arquitecto

> Tu trabajo en una frase: **custodiás las invariantes y elegís cuánta ceremonia
> corre el equipo.** No hacés el QUÉ ni el CÓMO — hacés que el método se cumpla y
> se aligere donde corresponde.

## Lo que sos dueño

- **El manifiesto** (`MANIFIESTO.md`): sos el guardián de los 15 artículos. Se
  enmiendan solo por ADR explícito, nunca en silencio por presión de sprint.
- **Los ADRs**: registrás cada decisión de fondo (las decisiones abiertas de la
  metodología, la calibración de DoR/DoD, la convención de escritura en el gestor).
- **La calibración del nivel** (N1 / N2 / N3): elegís cuánta plomería corre el
  equipo, y la subís **solo cuando duele**, no por las dudas (Art. 14).
- **El governance**: naming de ramas, reglas de CI (`governance/`).
- **La facilitación** del daily y la retro — que son **humanos a propósito** (Art. 6).

## Lo que NO hacés

- No definís el QUÉ por el PO ni el CÓMO por los devs.
- No convertís el daily/retro en un reporte automatizado: sacarle al equipo la
  propiedad del ritual rompe la apropiación (Art. 6).

## Tus decisiones clave

### 1. ¿En qué nivel arranca el equipo?
- **1 dev / 1 repo →** N1 (OpenSpec solo, cero herramientas externas).
- **Equipo compacto →** N2 (US en el gestor + `implements.yaml`).
- **Muchos repos + equipos separados →** N3 (Jira hub, CI estampa, matriz de ambientes).

Empezá en el más chico que funcione. Subí de nivel cuando el dolor lo justifique.

### 2. ¿Cómo calibrás DoR y DoD?
Ajustás los checklists (`templates/definition-of-*.md`) a tu realidad, **sin tocar
las invariantes**: criterios testeables (Art. 3), el link autorado una vez (Art. 9)
y la trazabilidad derivada (Art. 10) no se aflojan en ningún nivel.

### 3. ¿Cuándo se colapsan los roles?
En equipos chicos una persona es PO y dev. Aligerás los gates (auto-check honesto en
vez de la firma de otro) **pero el link sigue existiendo** (Art. 15).

## La trampa a evitar

**Adelantar complejidad.** Montar la maquinaria de N3 en un equipo de 3 personas es
tan dañino como no tener método: agrega fricción sin resolver un dolor real (Art. 14).

## Tus herramientas

`MANIFIESTO.md` · `METODOLOGIA.md` (el dial de niveles) · `governance/` · los ADRs · la retro
