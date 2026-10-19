# Fixtures del importador de Trade Republic

- `exportacion-2026.csv`: exportación **real** de una cuenta española, anonimizada (nombre, IBAN e IDs sustituidos).
- `sintetico-todos-los-tipos.csv` y `sintetico-separador-punto-y-coma.csv`: filas **sintéticas** escritas a mano. Reproducen la estructura documentada (columnas, signos y formatos) con importes inventados, IDs falsos (`00000000-0000-4000-8000-…`) e ISIN públicos. No contienen datos ni código de terceros.

Fuente de la estructura de cada línea de `sintetico-todos-los-tipos.csv` (detalle en `docs/trade-republic-csv.md`):

| Líneas | Tipo | Fuente |
|---|---|---|
| 2 | CASH/TRANSFER_INSTANT_INBOUND | Exportación real (TR-PEDRO) |
| 3 | CASH/CUSTOMER_INPAYMENT (con comisión) | PP-TEST 01 |
| 4, 9, 10, 11 | TRADING/BUY (STOCK, FUND, CRYPTO) | TR-PEDRO, PP-TEST 01 |
| 5, 6 | TRADING/BUY de plan de inversión (sin comisión, importe redondo) | PP-TEST 01 |
| 7, 8 | CASH/BENEFITS_SAVEBACK y su compra | PP-TEST 01 (la compra asociada no está verificada) |
| 12 | DELIVERY/FREE_RECEIPT/CRYPTO (staking) | Foro de Portfolio Performance |
| 13, 14 | DELIVERY/MIGRATION/CRYPTO en pareja | TR-PEDRO |
| 15, 17 | CASH/DIVIDEND (con divisa original y retención) | PP-TEST 01 |
| 16 | CASH/DISTRIBUTION/FUND | PP-TEST 01 |
| 18–20 | Dividendo, su corrección (importe negativo) y el corregido | PP-CODE, foro |
| 21 | CASH/INTEREST_PAYMENT (cuenta) | PP-TEST 01 |
| 22 | TRADING/SELL/STOCK | PP-TEST 01 |
| 23–26 | Bono: compra, cupón, CORPORATE_ACTION/REDEMPTION y CASH/FINAL_MATURITY | PP-TEST 01 |
| 27 | CORPORATE_ACTION/SPLIT | PP-TEST 01 |
| 28 | CASH/DIVIDEND_EQUIVALENT_PAYMENT | PP-TEST 01 |
| 29, 30 | CASH/EARNINGS y TAX_OPTIMIZATION (fiscalidad alemana) | PP-TEST 01 |
| 31–33 | Tarjeta, regalo y transferencia saliente | PP-TEST 01 y 02 |
| 34 | CASH/PRIVATE_MARKET_BUY/PRIVATE_FUND | PP-TEST 01 |
| 35 | Cuenta JUNIOR | PP-TEST 03 |
| 36 | CASH/STOCKPERK (nombrado en PP-CODE, sin fila de ejemplo) | PP-CODE |

`sintetico-separador-punto-y-coma.csv`: variante con `;`, sin comillas y con la columna `value_date` (estructura de PP-TEST 01).
