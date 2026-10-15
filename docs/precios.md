# Fuentes de precios

Verificado el 15 oct 2026. El servidor solo recibe identificadores (ticker, ISIN, id de CoinGecko o el texto buscado), nunca cantidades ni operaciones.

| Uso | Fuente | Clave | Límites conocidos |
|---|---|---|---|
| Cotización y búsqueda de acciones/ETF | Yahoo Finance vía `yahoo-finance2` 4.x | No | API no oficial; límites de uso no publicados y puede cambiar sin aviso. |
| ISIN → tickers por mercado | OpenFIGI `/v3/mapping` | Opcional (`OPENFIGI_API_KEY`) | Sin clave: 25 peticiones/min. |
| Cripto (precio, búsqueda e histórico) | CoinGecko API v3 | Opcional (`COINGECKO_DEMO_API_KEY`) | Sin clave, límites públicos más bajos. Histórico gratuito de como mucho 365 días. |

## Por qué Yahoo Finance

Es la única fuente gratuita y sin clave que cubre a la vez:
- las bolsas europeas en las que opera Trade Republic (XETRA `.DE`, Frankfurt, Milán…);
- búsqueda por ISIN;
- histórico diario.

Probado con VWCE.DE, AAPL, VWRA.L, VOD.L y SAP.DE, en local y desde Vercel.

## Conversión a EUR

La V1 trabaja solo en EUR:
- Las cotizaciones en otra divisa se convierten con el par de Yahoo `XXXEUR=X`. Cada par se pide por separado, porque Yahoo devuelve `USDEUR=X` con el símbolo `EUR=X`.
- Londres cotiza en peniques (`GBp`): se divide entre 100 antes de convertir.
- Para cotizar en EUR, mejor elegir el listado europeo del activo. Buscar por ISIN pone primero los listados en EUR.

## Cachés

- **CDN (Vercel):** precios 20 s, búsqueda 1 h, histórico 1 h (`Cache-Control: s-maxage`). Yahoo deja sin cierre la última sesión durante horas: ese día se completa con el último precio de mercado.
- **Navegador:** el último precio de cada activo se guarda en IndexedDB y se refresca si tiene más de 25 s, y cada 30 s con la app abierta y visible (y al volver a ella).
- **Retraso de la fuente:** aun así no es tiempo real. Yahoo suele dar las bolsas europeas con unos 15 min de retraso y CoinGecko con 1–2 min; la app muestra siempre la hora de cada precio.
- **Si una fuente falla**, se sigue mostrando el último precio guardado con su hora. Un precio nunca rompe la app.

## Activos sin fuente

Un activo creado a mano usa `priceSource: "manual"`; su precio se fija desde la ficha de la posición en Cartera.
