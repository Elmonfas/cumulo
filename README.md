<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/svg/lockup-blanco.svg">
    <img src="docs/brand/svg/lockup-negro.svg" alt="cúmulo" height="56">
  </picture>
</p>

<p align="center">
  <strong>Tu cartera de inversión, clara y privada.</strong><br>
  PWA para seguir y analizar acciones, ETF y cripto. Pensada para quien invierte con Trade Republic desde España.
</p>

<p align="center">
  <a href="https://cumulo-nine.vercel.app"><strong>Abrir la app →</strong></a>
</p>

---

## Por qué cúmulo

- **Tus datos no salen de tu dispositivo.** Operaciones, cantidades y ajustes viven solo en tu navegador (IndexedDB). El servidor únicamente recibe identificadores públicos (ticker, ISIN o id de CoinGecko) para pedir precios. Sin cuentas, sin rastreadores. Si activas las notificaciones, guarda además la suscripción del dispositivo, el horario del recordatorio y, si lo eliges, el activo y el precio de cada alerta; nunca cantidades.
- **Cifras exactas.** Todo importe se calcula con `decimal.js`, nunca con coma flotante, y la lógica financiera está cubierta por tests escritos a mano.
- **Hecha para el inversor español.** Formato es-ES (`1.234,56 €`), FIFO como manda Hacienda e informe orientativo para la declaración de la Renta.

## Qué hace

| | |
|---|---|
| **Inicio** | Valor de la cartera en vivo, ganancia, variación por periodo (1D · 1S · 1M · YTD · 1A · Todo) con datos intradía, distribución, rentabilidad por posición y comparación con un índice (MSCI World, S&P 500, All-World). |
| **Cartera** | Posiciones abiertas y cerradas, coste medio, no realizado, realizado, TIR, lista de seguimiento y alertas de precio. Cada posición tiene su gráfica de precio con tus compras y ventas marcadas y la línea de tu precio medio. |
| **Operaciones** | Alta manual de compras, ventas y dividendos (con retención) y un buscador de activos por nombre, ticker o ISIN. Búsqueda, filtros y exportación a CSV. No deja vender más de lo que tienes. |
| **Herramientas** | Objetivos de ahorro (progreso, aportación mensual necesaria y si llegas al ritmo actual), calendario de operaciones (cada día con compras o ventas, más intenso cuanto más dinero), informe para la Renta (FIFO, regla de los dos meses, compensación ganancias/dividendos, cuota estimada y CSV), «Tu año en cúmulo», interés compuesto y simulador de aportaciones periódicas con precios reales. |
| **Ajustes** | Notificaciones push (recordatorio mensual para importar y alertas de precio con la app cerrada, también en iPhone), tema claro/oscuro/sistema, modo privado (oculta importes), periodo por defecto y copia de seguridad JSON para llevarte tus datos a otro navegador. |

Además: instalable como app (PWA) con página sin conexión, tarjetas para compartir una posición, una operación, la cartera o tu año (temas oscuro, claro y morado; sin importes si no quieres), y precios que se refrescan cada 30 s con la app abierta.

## Gráficas fieles al mercado

- **1D, 1S y 1M usan precios intradía** (5 min, 30 min y 1 h). 1D se mide frente al cierre anterior, como en un bróker; con la bolsa cerrada se muestra la última sesión.
- **Sin suavizado**: líneas rectas entre puntos, para no inventar picos ni valles.
- **Ejes legibles**: marcas «redondas» (1, 2, 2,5 o 5 × 10ⁿ) y decimales según el rango, sin etiquetas repetidas.
- **Cripto con histórico completo**: CoinGecko gratis solo da 365 días; el tramo anterior se completa con el par `XXX-EUR` de Yahoo, validado contra CoinGecko en el día de unión.

## Fuentes de precios

| Uso | Fuente | Notas |
|---|---|---|
| Acciones y ETF | Yahoo Finance (`yahoo-finance2`) | API no oficial y sin clave. Conversión a EUR con el par de divisas del mismo día. |
| ISIN → ticker | OpenFIGI | 25 peticiones/min sin clave. |
| Cripto | CoinGecko | Con respaldo en Yahoo si alcanza su límite de uso. |

Todas las peticiones pasan por las rutas `/api/*` de la propia app (con caché en el CDN), así ningún tercero ve qué activos consultas. Detalles y límites en [docs/precios.md](docs/precios.md).

## Notificaciones

Push real (Web Push con VAPID), también en iPhone con iOS 16.4+ si cúmulo está **añadida a la pantalla de inicio** desde Safari. Se activan en Ajustes › Notificaciones.

- **Qué guarda el servidor** (Upstash Redis): la suscripción del dispositivo, el día y la hora del recordatorio y, solo con «Alertas de precio con la app cerrada», el activo, la condición y el precio de cada alerta. «Desactivar en este dispositivo» lo borra todo.
- **Cuándo se comprueba**: un workflow de GitHub Actions ([push-cron.yml](.github/workflows/push-cron.yml)) llama a `/api/push/cron` cada 15 minutos (GitHub puede retrasarlo unos minutos); Vercel Cron lo hace además una vez al día, de respaldo.
- **Configuración**: `VAPID_PRIVATE_KEY` y `CRON_SECRET` en Vercel, `KV_REST_API_URL` y `KV_REST_API_TOKEN` (las crea la integración de Upstash) y `CRON_SECRET` también como secreto de GitHub Actions. La clave pública está en [src/push/config.ts](src/push/config.ts). Sin Redis, en local se usa memoria.

## Seguridad

- Cabeceras estrictas: `Content-Security-Policy` (todo desde el propio dominio), `Permissions-Policy`, `X-Frame-Options: DENY`, `nosniff`, `COOP` y HSTS.
- El proxy de logos solo reenvía imágenes rasterizadas de tamaño acotado y con `sandbox`.
- Las rutas de la API validan cada identificador y fecha antes de llamar a una fuente. Las de push solo aceptan suscripciones de los servicios de Apple, Google, Mozilla y Microsoft, y el programador exige `CRON_SECRET`.
- Los backups se validan campo a campo antes de restaurarse (fechas reales, decimales, avatar solo como imagen embebida) y el CSV exportado neutraliza fórmulas.

## Desarrollo

Requisitos: **Node 24** y **pnpm**.

```bash
pnpm install
```

```bash
pnpm dev
```

Comprobaciones antes de cada commit:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Variables de entorno opcionales (ver [.env.example](.env.example)): `COINGECKO_DEMO_API_KEY` y `OPENFIGI_API_KEY` suben los límites de uso. Sin ellas todo funciona con las APIs públicas.

### Stack

Next.js (App Router) · React 19 · TypeScript estricto · Tailwind CSS v4 · Recharts · Dexie (IndexedDB) · decimal.js · Zustand · Serwist (PWA) · Vitest + Testing Library. Desplegada en Vercel.

### Estructura

```
src/
  app/                  rutas y API (/api/prices, /api/prices/history, /api/prices/intraday, /api/assets/search, /api/logo)
  components/           pantallas, gráficas y primitivas de UI
  data/                 esquema Dexie y repositorios (la UI nunca habla con Dexie directamente)
  domain/               lógica pura y testeada: cartera FIFO, valoración, históricos, TIR, Renta, interés compuesto…
  importers/            importación de CSV
  prices/               clientes de Yahoo, CoinGecko y OpenFIGI (solo servidor)
  services/             casos de uso que unen dominio y repositorios
  lib/                  formato es-ES, ejes de gráficas, CSV, tema, privacidad
```

### Reglas de dominio

- Ganancia realizada por **FIFO** (criterio fiscal español); las comisiones de compra suman al coste.
- No realizado = valor de mercado − coste de las posiciones abiertas. Rentabilidad simple y TIR (a partir de un año).
- El efectivo vive en el bróker: la cartera solo lleva compras, ventas y dividendos.

Las reglas completas del proyecto están en [CLAUDE.md](CLAUDE.md) y las ideas aparcadas en [IDEAS.md](IDEAS.md).

## Estado

- ✅ Registro manual, precios, cartera, gráficas, estadísticas, backup, PWA, Renta.
- ✅ **Importador de Trade Republic** sobre el CSV oficial «Exportación de transacciones»: compras, ventas, detección de duplicados (reimportaciones y operaciones ya registradas a mano) y activos resueltos por ISIN o ticker cripto.
- 🚧 Dividendos, planes de ahorro e intereses del CSV: se omiten indicando su tipo hasta tener ejemplos reales.

## Aviso

cúmulo es una herramienta personal de seguimiento. Los precios pueden llegar con retraso y el informe para la Renta es una estimación orientativa: no es asesoramiento financiero ni fiscal.
