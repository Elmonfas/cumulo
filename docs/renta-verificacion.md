# Verificación a mano del informe para la Renta

Casos calculados a mano que reproducen los tests de `src/domain/tax.test.ts` («taxReport: intereses y doble imposición internacional»). Todos los importes son en euros y se redondean al céntimo (half-up).

## Reglas usadas

- **Escala del ahorro (2025+)**: 19 % hasta 6.000 €, 21 % hasta 50.000 €, 23 % hasta 200.000 €, 27 % hasta 300.000 € y 30 % a partir de ahí.
- **Rendimientos del capital mobiliario (RCM)**: dividendos e intereses, por su importe bruto menos comisiones.
- **Compensación (art. 49 LIRPF)**: si el saldo de ganancias y pérdidas es negativo, compensa como mucho el 25 % del saldo positivo de RCM.
- **Deducción por doble imposición internacional (art. 80 LIRPF)** = el menor de:
  - (a) el impuesto pagado en el extranjero, limitado al tipo del convenio (15 % por defecto);
  - (b) el tipo medio del ahorro (cuota ÷ base) aplicado al rendimiento extranjero que queda en la base.
- **Pagos a cuenta**: solo las retenciones españolas.
- **Resultado** = cuota − deducción − retenciones españolas.
- **No recuperable** = retención extranjera − deducción.

## Caso 1: dividendos de EE. UU. con un 15 % de retención

Datos: dividendo bruto de 200,00 € de una acción con ISIN `US…`, retención en origen 30,00 € (15 %).

| Concepto | Cálculo | Importe |
|---|---|---|
| Base del ahorro | 200,00 | 200,00 |
| Cuota | 200,00 × 19 % | **38,00** |
| Tipo medio | 38,00 ÷ 200,00 | 19 % |
| (a) Impuesto extranjero limitado | mín(30,00; 200,00 × 15 % = 30,00) | 30,00 |
| (b) Tipo medio × rendimiento | 19 % × 200,00 | 38,00 |
| Deducción doble imposición | mín(30,00; 38,00) | **30,00** |
| Retenciones españolas | — | 0,00 |
| No recuperable | 30,00 − 30,00 | **0,00** |
| Resultado | 38,00 − 30,00 − 0,00 | **8,00 a pagar** |

## Caso 2: intereses con pérdidas que se compensan al 25 %

Datos: intereses de la cuenta de 1.000,00 € con retención española de 190,00 € (19 %). Venta de una cripto comprada por 3.000,00 € y vendida por 2.000,00 € (pérdida de 1.000,00 €; a la cripto no se le aplica la regla de los dos meses).

| Concepto | Cálculo | Importe |
|---|---|---|
| Saldo de ganancias y pérdidas | 2.000,00 − 3.000,00 | −1.000,00 |
| RCM | 1.000,00 | 1.000,00 |
| Compensación máxima | 25 % × 1.000,00 | 250,00 |
| Compensación aplicada | mín(1.000,00; 250,00) | 250,00 |
| Base del ahorro | 1.000,00 − 250,00 | **750,00** |
| Pérdidas para los 4 años siguientes | 1.000,00 − 250,00 | **750,00** |
| Cuota | 750,00 × 19 % | **142,50** |
| Deducción doble imposición | sin rentas extranjeras | 0,00 |
| Retenciones españolas | — | 190,00 |
| Resultado | 142,50 − 0,00 − 190,00 | **47,50 a devolver** |

## Caso 3: retención por encima del límite del convenio

Datos: dividendo bruto de 100,00 € de una acción suiza (ISIN `CH…`), retención en origen 35,00 € (35 %). Límite del convenio: 15 %.

| Concepto | Cálculo | Importe |
|---|---|---|
| Base del ahorro | 100,00 | 100,00 |
| Cuota | 100,00 × 19 % | **19,00** |
| (a) Impuesto extranjero limitado | mín(35,00; 100,00 × 15 % = 15,00) | 15,00 |
| (b) Tipo medio × rendimiento | 19 % × 100,00 | 19,00 |
| Deducción doble imposición | mín(15,00; 19,00) | **15,00** |
| No recuperable en la declaración | 35,00 − 15,00 | **20,00** |
| Resultado | 19,00 − 15,00 | **4,00 a pagar** |

Los 20,00 € que pasan del convenio solo se pueden reclamar a Suiza.

## Caso 4: con pérdidas, manda el tipo medio

Datos: dividendo bruto de 1.000,00 € de EE. UU. con retención de 150,00 € (15 %). Venta de una cripto comprada por 3.000,00 € y vendida por 1.000,00 € (pérdida de 2.000,00 €).

| Concepto | Cálculo | Importe |
|---|---|---|
| Saldo de ganancias y pérdidas | 1.000,00 − 3.000,00 | −2.000,00 |
| Compensación aplicada | mín(2.000,00; 25 % × 1.000,00) | 250,00 |
| Base del ahorro | 1.000,00 − 250,00 | **750,00** |
| Cuota | 750,00 × 19 % | **142,50** |
| Tipo medio | 142,50 ÷ 750,00 | 19 % |
| Rendimiento extranjero en la base | mín(1.000,00; 750,00) | 750,00 |
| (a) Impuesto extranjero limitado | mín(150,00; 1.000,00 × 15 %) | 150,00 |
| (b) Tipo medio × rendimiento en la base | 19 % × 750,00 | 142,50 |
| Deducción doble imposición | mín(150,00; 142,50) | **142,50** |
| No recuperable | 150,00 − 142,50 | **7,50** |
| Resultado | 142,50 − 142,50 | **0,00** |

## Limitaciones conocidas

- La deducción se calcula en conjunto para todas las rentas extranjeras del año, no país por país.
- El país de la retención se deduce del ISIN del valor; los intereses de la cuenta de Trade Republic se toman como retención española. Es una suposición, porque no hay filas reales de una cuenta española con retención (ver `docs/trade-republic-csv.md`).
- La tabla de convenios (`TREATY_RATES` en `src/domain/tax.ts`) está vacía: se aplica el 15 % por defecto a todos los países.
