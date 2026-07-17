# Manifiesto — Desarrollo Asistido por IA

> **Qué es esto.** La *constitución* de la metodología: los principios inmutables
> contra los que se mide toda decisión. Cuando `grill-intent` desafía un problema,
> lo hace contra estos artículos. Cuando dudas si algo "va con el método", la
> respuesta está aquí. Es corto a propósito — un manifiesto que no se puede citar de
> memoria no gobierna nada.
>
> **Cómo se usa.** Es el input de constitución que las skills asumen (junto con
> `openspec/project.md` y `CLAUDE.md`). No se negocia por conveniencia de un
> sprint. Se cambia por decisión explícita del equipo, registrada como ADR.

---

## Los cuatro valores

1. **El QUÉ y el CÓMO son cosas distintas, con dueños distintos.**
2. **La IA asiste; la persona decide.**
3. **Nada existe si no se puede testear ni trazar.**
4. **La ceremonia se agrega cuando duele, no antes.**

Todo lo que sigue son artículos que hacen operativos esos cuatro valores.

---

## I. Sobre el QUÉ y el CÓMO

<a id="art-1"></a>**Art. 1 — Separación de responsabilidades.**
El *funcional* define **qué** hay que hacer y **por qué**. El *técnico* define
**cómo**. Nadie invade el terreno del otro: la US no dice endpoints ni tablas; el
design no re-discute el valor de negocio.

<a id="art-2"></a>**Art. 2 — El QUÉ es tool-agnóstico.**
El requerimiento vive con una identidad y una forma mínima que **no dependen de la
herramienta de abajo** (OpenSpec, Swagger, YAML, Markdown). Cambiar la herramienta
técnica no rompe el link.

<a id="art-3"></a>**Art. 3 — Testeable o no existe.**
Un criterio de aceptación que no se puede volver un test, no es un criterio. *"El
usuario tiene una buena experiencia"* se rechaza. *"Un carrito vacío no se puede
finalizar"* se acepta. Si no es verificable, no entra.

## II. Sobre la IA y el humano (HITL)

<a id="art-4"></a>**Art. 4 — La IA saca a preguntas, no inventa.**
El QUÉ se produce **por interrogación** (`grill-*`), no por generación. La IA no
adivina requerimientos: presiona hasta que la persona los explicita. Un QUÉ que la
IA "completó sola" es una alucinación con formato lindo.

<a id="art-5"></a>**Art. 5 — La persona firma.**
Toda decisión irreversible o de negocio —aceptar una US, aprobar un PR, descartar
un problema— la toma y la firma un humano. La IA propone; nunca autoriza.

<a id="art-6"></a>**Art. 6 — Los rituales de coordinación son humanos.**
El *daily* y la *retro* se hacen a mano, a propósito. Son donde el equipo se
apropia del proceso y lo entiende. La IA puede darles datos; no los reemplaza.

<a id="art-7"></a>**Art. 7 — No vibe coding.**
No se improvisa código sobre una idea vaga. Toda implementación parte de una US
bien definida, pasa por un design, y se construye con tests. La disciplina no es
opcional: es lo que separa este método de "pedirle cosas a un chat".

## III. Sobre la trazabilidad

<a id="art-8"></a>**Art. 8 — Identidad estable.**
Todo QUÉ nace con un ID único, independiente del path y del formato. Es lo único
que lo hace linkeable. No se inventa un esquema nuevo: es el ticket del gestor (o
el change en el nivel más chico).

<a id="art-9"></a>**Art. 9 — El link se autora una sola vez.**
El CÓMO declara `implements: <id>@<version>`. Es el **único** link escrito a mano.
La dirección inversa (quién implementó qué) **siempre se deriva, nunca se escribe**.
Escribirlo en los dos lados es firmar la desincronización.

<a id="art-10"></a>**Art. 10 — El estado se deriva, no se reporta.**
La matriz de trazabilidad —quién implementó qué, contra qué versión, quién quedó
atrasado— no la mantiene ninguna persona. La calcula la máquina a partir de los
links. Si alguien la actualiza a mano, algo está mal diseñado.

<a id="art-11"></a>**Art. 11 — El versionado avisa solo.**
El `@version` (número legible + hash de criterios) hace que un cambio del QUÉ marque
solo a los CÓMO atrasados. Nadie avisa a nadie: el link versionado lo grita. El
número comunica; el hash detecta.

<a id="art-12"></a>**Art. 12 — Capacidad entera, detalle on-demand.**
El link es a nivel de capacidad/US entera, no criterio-por-criterio. Si el QUÉ sabe
*quién* lo implementó, el detalle fino se resuelve leyendo el repo por ID. El índice
central es un **router, no un almacén**.

## IV. Sobre la escala

<a id="art-13"></a>**Art. 13 — Un protocolo, varios niveles de ceremonia.**
No hay una metodología para equipos chicos y otra para grandes. Hay **un** protocolo
invariante (Arts. 1–12) y un dial de ceremonia que sube o baja según la escala. El
que aprende el nivel chico ya sabe el grande.

<a id="art-14"></a>**Art. 14 — No adelantar complejidad.**
Cada capa de plomería (tracker externo, CI que estampa, matriz de ambientes) se
agrega **cuando duele, no antes**. Empezar con la maquinaria completa "por las
dudas" es tan malo como no tener método.

<a id="art-15"></a>**Art. 15 — Los roles se colapsan, el link no.**
Cuando una misma persona es autor del QUÉ y del CÓMO, los gates se aligeran (un
auto-check honesto en vez de la firma de otro), pero el link `implements` **sigue
existiendo**. La ceremonia se achica; la trazabilidad no se negocia.

---

## Cómo se enmienda

Estos artículos se cambian solo por **decisión explícita del equipo**, registrada
como un ADR con fecha y motivo. Ningún sprint, deadline ni "esta vez es distinto"
alcanza para saltárselos en silencio. Si un artículo estorba seguido, esa es la
señal de que hay que debatirlo y enmendarlo — no de ignorarlo.
