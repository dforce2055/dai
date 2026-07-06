// Tests del contrato ac_hash (ADR-0001). Correr: node --test cli/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { acHash, extractAcBlock, normalizeAcBlock } from "../lib/ac-hash.mjs";

const US = `# 🔗 Metadata
| ID | ABC-482 |

## 🔗 Criterios de aceptación

- [ ] **AC-1** —
  - **Dado** un carrito con productos con stock
  - **Cuando** el comprador finaliza la compra
  - **Entonces** se crea la orden y el carrito queda vacío
- [ ] **AC-2** —
  - **Dado** un carrito vacío
  - **Cuando** se intenta finalizar la compra
  - **Entonces** el sistema lo rechaza y NO crea ninguna orden

## Fuera de scope

- El pago es otra US.
`;

test("extrae solo el bloque de criterios, sin lo de abajo", () => {
  const block = extractAcBlock(US);
  assert.match(block, /un carrito con productos con stock/);
  assert.doesNotMatch(block, /Fuera de scope/);
  assert.doesNotMatch(block, /El pago/);
});

test("produce un hash de 8 hex", () => {
  const h = acHash(US);
  assert.match(h, /^[0-9a-f]{8}$/);
});

test("un cambio EDITORIAL no cambia el hash", () => {
  // mismos criterios, distinto formato: más espacios, viñetas *, sin checkbox
  const editorial = US
    .replace(/- \[ \] \*\*AC-1\*\* —/, "* AC-1:")
    .replace(/\*\*Dado\*\*/g, "Dado")
    .replace(/  - /g, "    -   ");
  assert.equal(acHash(editorial), acHash(US));
});

test("un cambio MATERIAL sí cambia el hash", () => {
  const material = US.replace(
    /NO crea ninguna orden/,
    "crea la orden igual"
  );
  assert.notEqual(acHash(material), acHash(US));
});

test("reordenar los criterios cambia el hash (orden significativo)", () => {
  // misma US con AC-1 y AC-2 intercambiados de lugar
  const reordenada = `## 🔗 Criterios de aceptación

- [ ] **AC-2** —
  - **Dado** un carrito vacío
  - **Cuando** se intenta finalizar la compra
  - **Entonces** el sistema lo rechaza y NO crea ninguna orden
- [ ] **AC-1** —
  - **Dado** un carrito con productos con stock
  - **Cuando** el comprador finaliza la compra
  - **Entonces** se crea la orden y el carrito queda vacío

## Fuera de scope
`;
  assert.notEqual(acHash(reordenada), acHash(US));
});

test("sin bloque de criterios devuelve null", () => {
  assert.equal(acHash("# Una US\n\nsin criterios acá"), null);
});
