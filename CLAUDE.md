# CLAUDE.md — cúmulo

## Qué es
cúmulo es una PWA personal para seguir y analizar inversiones (acciones, ETF, cripto), con Trade Republic como primer origen de datos. Hoy es una herramienta de uso personal, pero se construye con calidad de producto para poder lanzarla algún día.
Idioma de la UI: español (es-ES). Moneda: solo EUR en la V1.

## Principios no negociables
1. **Privacidad**: los datos financieros viven SOLO en el navegador (IndexedDB vía Dexie). El servidor nunca recibe cantidades, operaciones ni datos personales; solo tickers/ISIN para pedir precios.
2. **Dinero con decimal.js**: nunca uses `number` para importes, cantidades o precios. Se persisten como string y se operan con Decimal.
3. **Los cálculos financieros llevan tests** (Vitest), con casos escritos a mano y comprobados.
4. **Fase a fase**: implementa solo la fase pedida. Al acabar, para y muestra la lista de validación. Las ideas fuera de alcance van a `IDEAS.md`, nunca al código.
5. **Escalable sin backend**: todo acceso a datos pasa por interfaces de repositorio (`src/data/repositories`). Hoy hay una implementación Dexie; mañana podría haber una de Supabase sin tocar la UI.

## Stack
- Next.js (App Router, última estable) + TypeScript `strict`
- Tailwind CSS v4 + shadcn/ui (personalizado con los tokens de abajo; nada con aspecto por defecto)
- Recharts · Dexie · decimal.js · Zustand (solo estado de UI/preferencias) · Papa Parse · Serwist (PWA) · Vitest + Testing Library
- Fuentes: Geist Sans / Geist Mono (paquete `geist`)
- Deploy: Vercel. Gestor de paquetes: pnpm.

## Estructura
```
src/
  app/                 # rutas: / (inicio), /cartera, /operaciones, /herramientas/interes-compuesto, /ajustes
    api/prices/        # proxy de precios (solo recibe identificadores)
  components/ui/       # primitivas (shadcn adaptado)
  components/          # tarjetas, gráficas, layout
  data/
    db.ts              # esquema Dexie
    repositories/      # interfaces + implementación Dexie
  domain/              # lógica pura y testeada: cartera, FIFO, rentabilidad, interés compuesto
  importers/trade-republic/
  prices/              # clientes de proveedores + caché
  lib/format.ts        # formato es-ES de moneda, %, fechas
```
La lógica de `domain/` es pura (sin React ni Dexie) y es la parte con más tests.

## Sistema de diseño
Define estos tokens como variables CSS en `:root` y `.dark`, y mapéalos en Tailwind. El tema puede ser claro, oscuro o sistema, y se persiste.

| Token | Oscuro | Claro |
|---|---|---|
| bg | #0A0A0F | #F5F5F8 |
| surface | #14141B | #FFFFFF |
| surface-2 | #1C1C25 | #F0EFF5 |
| border | #262631 | #E6E5EE |
| text | #F4F4F7 | #0E0E14 |
| text-muted | #8B8A9B | #6B6A7A |
| accent | #A78BFA | #7C3AED |
| series-2 | #FACC15 | #F59E0B |
| series-3 (rosa) | #F472B6 | #DB2777 |
| series-4 (verde) | #34D399 | #059669 |
| series-5 (azul) | #60A5FA | #2563EB |
| series-6 (naranja) | #FB923C | #EA580C |
| positive | #4ADE80 | #16A34A |
| negative | #F87171 | #DC2626 |

Reglas:
- Tarjetas con radio de 24px, borde de 1px y sin sombras en oscuro (una sombra muy suave como máximo en claro). Gap de 16px en móvil y 20px en desktop.
- La cifra protagonista mide 48–56px, peso 500, tracking -0.02em, `tabular-nums` siempre.
- Morado = acento/selección. Verde y rojo SOLO para variaciones. Las gráficas de distribución usan la paleta de series (morado, amarillo, verde, rosa, azul, naranja: tokens series-2…series-6); fuera de las gráficas no se usan otros colores.
- Selector de periodo en píldora: 1D · 1S · 1M · YTD · 1A · Todo.
- Badge de variación: píldora con flecha, `↗ 2,4 %`, fondo positive/negative al 15 %.
- Gráficas de área con degradado accent→transparente, sin rejilla vertical y con tooltip en píldora.
- Navegación: bottom bar en móvil (Inicio, Cartera, Operaciones, Herramientas) y sidebar fina en desktop.
- Animaciones de 150–200ms ease-out; la cifra principal cuenta hasta su valor al cargar. Respeta `prefers-reduced-motion`.
- Formato es-ES siempre: `1.234,56 €`, `+3,2 %`, `15 oct 2026`.
- Mobile-first: a 375px todo debe verse perfecto.
- Cada pantalla sin datos tiene un estado vacío diseñado, con una acción clara (importar CSV / añadir operación).

## Modelo de datos (Dexie)
- `assets`: id, name, ticker?, isin?, type ('stock'|'etf'|'crypto'|'other'), priceSource ('coingecko'|'yahoo'|'manual'), priceSourceId
- `transactions`: id, assetId?, type ('buy'|'sell'|'dividend'|'fee'|'deposit'|'withdrawal'), date (ISO), quantity, price, fee, tax (strings decimales), origin ('manual'|'csv-tr'), importHash?
- `priceCache`: assetId, price, currency, updatedAt
- `settings`: theme, profileName, avatar (dataURL), defaultPeriod

## Reglas de dominio
- Coste medio ponderado por activo. Las comisiones de compra se suman al coste.
- Ganancia realizada por FIFO (criterio fiscal español). No se permite vender más de lo que se tiene.
- No realizado = valor de mercado − coste de las posiciones abiertas.
- Rentabilidad simple en la V1 (la TWR es V2).
- Interés compuesto: capitalización mensual, aportación al final de cada mes, inflación opcional para mostrar el valor real.

## Precios
- Cripto: API de CoinGecko (clave demo en `.env`), caché de 1–2 min.
- Acciones/ETF: primero ISIN → ticker con la API de OpenFIGI, y después la cotización a través de `/api/prices` (yahoo-finance2 o la mejor fuente gratuita que verifiques en la Fase 4; documenta la elección y sus límites).
- Si una fuente falla, se muestra el último precio guardado con su hora. Un precio jamás rompe la app.

## Importador de Trade Republic
- Usa el CSV oficial "Exportación de transacciones" (disponible desde abril de 2026).
- No asumas el formato: construye el parser sobre el CSV real que te pase en la Fase 3 y crea fixtures de test anonimizadas a partir de él.
- Flujo: subir → vista previa con totales → marcar duplicados (`importHash`) → confirmar. Reimportar el mismo archivo no duplica nada.

## Fases
| # | Fase | Validación |
|---|---|---|
| 0 | Cimientos: repo, tokens, layout, tema, PWA, deploy | Se instala en el móvil; el tema cambia y persiste |
| 1 | Calculadora de interés compuesto | 3 casos cuadran al céntimo con una hoja de cálculo; tests en verde |
| 2 | Registro manual de operaciones + buscador de activos | 10 operaciones sobreviven a la recarga; la venta excesiva se rechaza |
| 3 | Importador CSV de Trade Republic | Nº de operaciones y efectivo cuadran con TR; reimportar no duplica |
| 4 | Precios + pantalla de cartera/balance | Valor total a ±1 % del de TR a la misma hora |
| 5 | Gráficas y estadísticas | Todas cuadran con la tabla de la Fase 4 |
| 6 | Pulido: estados vacíos, animaciones, backup JSON, a11y | Lighthouse ≥ 90; el backup se restaura en otro navegador |

## Forma de trabajar
- Antes de cada fase: plan en 10 líneas como máximo y esperar mi OK.
- Después: `pnpm lint && pnpm typecheck && pnpm test`, commit convencional y lista de validación marcada.
- Si algo de este archivo es ambiguo o choca con la realidad (una API que cambió, por ejemplo), pregunta en vez de inventar.
- Nada de V2 (dividendos, objetivos, fiscalidad, multidivisa, nube) hasta que yo lo pida.

@AGENTS.md
