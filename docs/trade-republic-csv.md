# CSV «Exportación de transacciones» de Trade Republic

Inventario de lo que se sabe del formato, para construir el importador sin adivinar. Investigado el 19 oct 2026.

## Fuentes

| Id | Fuente | Qué aporta |
|---|---|---|
| **TR-PEDRO** | Exportación real de una cuenta española (anonimizada en `src/importers/trade-republic/fixtures/exportacion-2026.csv`) | Formato español actual: separador `,`, todo entre comillas, columna `mcc_code`. |
| **PP-TEST** | Tests de Portfolio Performance, `TransactionExport01.csv` … `06.csv` ([carpeta](https://github.com/portfolio-performance/portfolio/tree/master/name.abuchen.portfolio.tests/src/name/abuchen/portfolio/datatransfer/traderepublic)). El importador se publicó el 11–15 abr 2026 con datos de prueba de la propia TR. | 34 combinaciones category/type/asset_class de cuentas alemanas. |
| **PP-CODE** | [`TradeRepublicCSVExtractor.java`](https://github.com/portfolio-performance/portfolio/blob/master/name.abuchen.portfolio/src/name/abuchen/portfolio/datatransfer/traderepublic/TradeRepublicCSVExtractor.java) | Cómo interpreta cada campo (solo lectura, ver licencia). |
| **PP-FORO** | [Hilo «Import Trade Republic CSV (Transaktionsexport)»](https://forum.portfolio-performance.info/t/import-trade-republic-csv-transaktionsexport/39126) (15–28 abr 2026) | `DELIVERY/FREE_RECEIPT` (staking de cripto), `CARD_ORDERING_FEE`, `CARD_TRANSACTION_INTERNATIONAL` y correcciones de dividendos. |

**Licencia**: Portfolio Performance se distribuye con **Eclipse Public License 1.0**. No se copia su código ni sus archivos de prueba; los fixtures de cúmulo son filas sintéticas propias que reproducen la estructura documentada.

## Formato general

- Cabecera: `datetime, date, account_type, category, type, asset_class, name, symbol, shares, price, amount, fee, tax, currency, original_amount, original_currency, fx_rate, description, transaction_id, counterparty_name, counterparty_iban, payment_reference` y, según la versión, `value_date` (PP-TEST 01) o `mcc_code` (TR-PEDRO).
- Separador `,` o `;`, con o sin comillas (las dos variantes aparecen en PP-TEST). Decimales con punto.
- `account_type`: `DEFAULT` y `JUNIOR` (cuenta para menores, PP-TEST 03).
- **Signos** (PP-CODE, comprobado con TR-PEDRO):
  - `amount` es el **importe bruto con signo de caja**: negativo si sale dinero (compra) y positivo si entra (venta, dividendo, interés).
  - `fee` y `tax` vienen **siempre en negativo** cuando se cobran. `tax` positivo es una devolución.
  - Neto en caja = `amount + fee + tax`. PP usa `|amount + fee + tax|` como importe de la operación.
  - `shares` es positivo en compras y entradas y **negativo en ventas y salidas**.
- `symbol`: ISIN en acciones, fondos, bonos y derivados; ticker en cripto (`BTC`, `ETH`).
- `original_amount`, `original_currency` y `fx_rate`: importe en divisa cuando hubo cambio. `amount` ya viene en EUR.
- `transaction_id`: único por fila.

## Inventario

Las filas de ejemplo son sintéticas (cifras e IDs inventados) y se muestran solo con las columnas relevantes: `category,type,asset_class,symbol,shares,price,amount,fee,tax,description`.

### Operaciones con valores

| Combinación | Significa | Fuente | Ejemplo sintético | Cómo lo trata PP |
|---|---|---|---|---|
| `TRADING/BUY/{STOCK,FUND,CRYPTO,BOND,DERIVATIVE}` | Compra. **Las de plan de inversión también llegan así** (sin comisión e importe redondo). | TR-PEDRO, PP-TEST 01 | `TRADING,BUY,FUND,IE00BK5BQT80,0.581200,172.05,-100.00,,,BUY IE00BK5BQT80` | Compra por `|amount+fee+tax|`, comisión e impuestos como unidades. |
| `TRADING/SELL/{STOCK,FUND,CRYPTO}` | Venta. `shares` negativo, `amount` positivo. | PP-TEST 01 | `TRADING,SELL,STOCK,US0378331005,-2.000000,251.40,502.80,-1.00,,SELL US0378331005` | Venta por el neto; si comisión + impuesto superan lo cobrado, separa cargos. |
| `CASH/PRIVATE_MARKET_BUY/PRIVATE_FUND` | Compra de fondo de mercados privados (prepago). | PP-TEST 01 | `CASH,PRIVATE_MARKET_BUY,PRIVATE_FUND,XX0000000001,50.0000,,-50.00,,,Private Markets pre-payment` | Como una compra. |
| `CASH/PRIVATE_MARKET_SELL` | Venta de mercados privados. | PP-CODE (sin fila de ejemplo) | — | Como una venta. |
| `DELIVERY/MIGRATION/CRYPTO` | Traspaso interno de TR: llega en **pareja** −x/+x con la misma hora. | TR-PEDRO | `DELIVERY,MIGRATION,CRYPTO,BTC,-0.0010000000,70000.00,,,,MIGRATION BTC` (+ la misma con `0.0010000000`) | PP no trata `DELIVERY`. |
| `DELIVERY/FREE_RECEIPT/CRYPTO` | Entrega gratuita: recompensas de **staking**. Solo `shares` y `price`, sin `amount`. | PP-FORO (cs42) | `DELIVERY,FREE_RECEIPT,CRYPTO,ETH,0.0005000000,2800.00,,,,FREE_RECEIPT ETH` | PP no lo soporta (el usuario lo mete a mano). |
| `CORPORATE_ACTION/SPLIT/STOCK` | Desdoblamiento: participaciones extra a coste 0. | PP-TEST 01 | `CORPORATE_ACTION,SPLIT,STOCK,US0000000001,0.900000,,,,,SPLIT US0000000001` | Error: «split no soportado». |
| `CORPORATE_ACTION/{REDEMPTION,FINAL_MATURITY}/BOND` | Amortización de un bono: salen participaciones. El dinero llega en una fila `CASH/FINAL_MATURITY` aparte. | PP-TEST 01 | `CORPORATE_ACTION,REDEMPTION,BOND,DE0000000002,-10.000000,1.00,,,,REDEMPTION DE0000000002` | Se omite (informativa). |
| `CORPORATE_ACTION/WARRANT_EXERCISE/DERIVATIVE` | Ejercicio de un warrant; el dinero llega en `CASH/TILG`. | PP-TEST 01 | `CORPORATE_ACTION,WARRANT_EXERCISE,DERIVATIVE,DE0000000003,-100.000000,,,,,WARRANT_EXERCISE` | Se omite (informativa). |

### Rendimientos

| Combinación | Significa | Fuente | Ejemplo sintético | Cómo lo trata PP |
|---|---|---|---|---|
| `CASH/DIVIDEND/{STOCK,FUND}` | Dividendo. `amount` = **bruto**, `tax` = retención (negativa); neto = amount + tax. Con divisa, `original_*`. | PP-TEST 01 | `CASH,DIVIDEND,STOCK,US0000000004,10.000000,,8.50,,-1.28,Cash Dividend for ISIN US0000000004` | Dividendo neto con el impuesto como unidad. |
| `CASH/DIVIDEND/*` con `amount` negativo | **Corrección** de un dividendo anterior (mismos importes con signo contrario). | PP-CODE, PP-FORO | `CASH,DIVIDEND,STOCK,US0000000004,10.000000,,-8.50,,1.28,Cash Dividend corrected` | La empareja con el original invirtiendo signos; si no la encuentra, avisa. |
| `CASH/DISTRIBUTION/FUND` | Reparto de un ETF de distribución. Igual que un dividendo. | PP-TEST 01 | `CASH,DISTRIBUTION,FUND,IE0000000005,20.000000,,5.40,,-0.81,Distribution` | Como dividendo. |
| `CASH/DIVIDEND_EQUIVALENT_PAYMENT/STOCK` | «Capital Distribution»: **devolución de capital**, con divisa original. | PP-TEST 01 | `CASH,DIVIDEND_EQUIVALENT_PAYMENT,STOCK,NO0000000006,100.000000,,20.00,,-5.00,Capital Distribution for ISIN NO0000000006` | Como dividendo. |
| `CASH/INTEREST_PAYMENT/—` | **Intereses de la cuenta**. `tax` negativo si hay retención. | PP-TEST 01 | `CASH,INTEREST_PAYMENT,,,,,1.25,,-0.24,Interest payment` | Interés con impuesto. |
| `CASH/INTEREST_PAYMENT/BOND` | Cupón de un bono. | PP-TEST 01 | `CASH,INTEREST_PAYMENT,BOND,DE0000000002,10.000000,,0.30,,-0.06,Interest` | Interés del valor. |
| `CASH/FINAL_MATURITY/BOND` y `CASH/TILG/DERIVATIVE` | Dinero de la amortización o del ejercicio. | PP-TEST 01 | `CASH,FINAL_MATURITY,BOND,DE0000000002,10.000000,,10.00,,,Final maturity` | Como venta del valor (reembolso). |

### Fiscalidad alemana (no aplica a un residente en España)

| Combinación | Significa | Fuente | Cómo lo trata PP |
|---|---|---|---|
| `CASH/EARNINGS/FUND` | *Vorabpauschale*: base imponible anticipada alemana de los fondos; `amount` 0 y `tax` negativo. | PP-TEST 01 | Impuesto (o dividendo si hay importe). |
| `CASH/PRE_DETERMINED_TAX_BASE/FUND` | Ídem (base predeterminada). | PP-TEST 01 | Impuesto. |
| `CASH/SEC_ACCOUNT/BOND` | Ajuste fiscal de la cuenta de valores (`tax` con signo). | PP-TEST 01 | Impuesto. |
| `CASH/TAX_OPTIMIZATION/—` | Devolución o cargo por optimización fiscal alemana (`tax` con signo). | PP-TEST 01 | Impuesto o devolución. |

### Movimientos de efectivo (no son de la cartera)

| Combinación | Fuente | Nota |
|---|---|---|
| `CASH/TRANSFER_INSTANT_INBOUND`, `TRANSFER_INBOUND`, `TRANSFER_IN`, `CUSTOMER_INBOUND` | TR-PEDRO, PP-TEST 01 y 03 | Ingresos. |
| `CASH/CUSTOMER_INPAYMENT` | PP-TEST 01 | Ingreso con tarjeta; `fee` = comisión del ingreso. |
| `CASH/TRANSFER_INSTANT_OUTBOUND`, `TRANSFER_OUT`, `CUSTOMER_OUTBOUND_REQUEST` | PP-TEST 01 y 02 | Retiradas. |
| `CASH/CARD_TRANSACTION`, `CARD_TRANSACTION_INTERNATIONAL`, `CARD_ORDERING_FEE` | PP-TEST 01, PP-FORO | Pagos con tarjeta y comisiones de la tarjeta. |
| `CASH/GIFT` | PP-TEST 01 | Regalo de dinero a otra persona. |
| `CASH/BENEFITS_SAVEBACK` | PP-TEST 01 | **Saveback**: abono en efectivo (p. ej. 0,09 €). La compra con ese dinero llega aparte como `TRADING/BUY`. |
| Otros nombrados en PP-CODE sin filas de ejemplo: `BONUS`, `REFERRAL`, `STOCKPERK`, `KINDERGELD_BONUS`, `COMPENSATION`, `FEE`, `TAX`, `PAYMENT`, `MERGER`, `EXCHANGE`, `LIQUIDATION_PROCEEDS`, `EARLY_REDEMPTION`, `CAPITAL_INC_CASH`, `BOND_ACCRUED_INTEREST`, `VIBAN_*`… | PP-CODE | PP los trata como entrada o salida de efectivo según el signo. |

### Sin ninguna fuente

| Lo pedido | Situación |
|---|---|
| **Redondeos** (round-up) | No aparece en ninguna fuente. Probablemente llegan como `TRADING/BUY`, pero **no está verificado**. |
| **Plan de inversión** como tipo propio | No existe: los planes llegan como `TRADING/BUY` (PP-TEST 01, compras de 100,00 € sin comisión). |
| **Saveback como compra** | No hay tipo propio: el abono es `CASH/BENEFITS_SAVEBACK` y la compra, presumiblemente, `TRADING/BUY` (no verificado con una pareja real). |

## Dudas abiertas

1. **Retención extranjera frente a española**: hay una sola columna `tax`. En las cuentas alemanas de PP-TEST mezcla la retención en origen con impuestos alemanes. No hay ninguna fila de un dividendo de una cuenta española, así que no se sabe si TR España retiene IRPF ni cómo lo refleja.
2. **Intereses de TR España**: tampoco hay fila española que diga si se retiene el 19 %.
3. **`DIVIDEND_EQUIVALENT_PAYMENT`** («Capital Distribution»): en España una devolución de prima o capital reduce el coste de adquisición y no tributa como dividendo. PP lo trata como dividendo.
4. **`FREE_RECEIPT`** (staking): en España es rendimiento del capital mobiliario a valor de mercado, y ese valor es el coste de adquisición de las monedas recibidas.
5. **`SPLIT`**: cúmulo no tiene un modelo de desdoblamiento que conserve las fechas de compra FIFO.
6. **Cuenta `JUNIOR`**: ¿se importa con la cartera del titular o se omite?
