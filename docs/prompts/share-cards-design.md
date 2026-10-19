# Prompt: propuestas de diseño para las tarjetas de compartir de cúmulo

Copia todo lo que hay debajo de la línea en una sesión nueva de Claude Code abierta en este repositorio.

---

Quiero que diseñes **propuestas alternativas** para las tarjetas de compartir (share cards) de cúmulo. Ya existe un diseño; tu trabajo es proponer otros mejores para que yo elija. No sustituyas el actual: el tuyo tiene que convivir con él.

## Contexto

- cúmulo es una PWA de inversión (Next.js + TypeScript, ver `CLAUDE.md` y `README.md`). Público: inversor particular español, 25–40 años, que comparte su rentabilidad en Instagram Stories, WhatsApp y X.
- Las tarjetas se dibujan con la API de **Canvas 2D** en el navegador (`src/lib/share-card.ts`, función `renderShareCard(model, format, theme)`). Nada pasa por un servidor: es una promesa de privacidad de la app.
- Los datos llegan en un `CardModel` genérico (cabecera, cifra protagonista, gráfica de línea/donut/barras, hasta 6 cifras clave, fecha) que rellenan los builders de `src/lib/share-builders.ts` para cuatro tipos: posición, operación (compra/venta), cartera y "tu año".
- Formatos: historia 9:16 (1080×1920) y cuadrada 1:1 (1080×1080), exportadas a 2× (2160 px de ancho).
- Por defecto la tarjeta **no muestra importes en euros**, solo porcentajes y precios públicos; con el interruptor "Mostrar importes" añade euros. Tu diseño debe verse completo y equilibrado en ambos casos.
- El diseño actual (dirección "editorial de marca"): el símbolo de cúmulo (diez burbujas formando una "c") enorme y recortado en la esquina, cifra protagonista enorme en un solo color, cifras clave como lista tipográfica con filetes, sin brillos ni cristal, y tres temas (oscuro, claro y morado). Míralo antes de empezar: abre la app (`pnpm dev`), ve a Cartera → Compartir y prueba los temas.

## Sistema de diseño (obligatorio)

- Tipografía: Geist Sans (la de la app; usa `getComputedStyle(document.body).fontFamily`). `tabular-nums` para cifras.
- Colores en `src/app/globals.css` (tokens claro/oscuro). Morado = marca/acento. **Verde y rojo solo para variaciones** (subidas/bajadas). Paleta de series para distribuciones: morado, amarillo, verde, rosa, azul, naranja.
- Formato es-ES siempre: `1.234,56 €`, `+3,2 %`, `15 oct 2026` (usa `src/lib/format.ts`).
- Marca: el símbolo está en `LOGO_CIRCLES` de `src/lib/share-card.ts` y en `docs/brand/`.
- Nada de estética genérica de "dashboard IA": sin degradados morados por defecto, sin cristal, sin brillos neón salvo que tengan una razón.

## Qué quiero

1. **2 o 3 direcciones visuales distintas entre sí** (no variaciones del mismo diseño). Ideas para inspirarte, no obligatorias: póster suizo con retícula marcada; ticket o recibo bursátil; gráfica a sangre como protagonista; estilo Apple Wallet/Fitness; tipografía gigante con el número como elemento gráfico.
2. Cada dirección debe funcionar en los **4 tipos de tarjeta**, en **ambos formatos** y **con y sin importes**. Textos largos (nombres de fondos como "Vanguard FTSE All-World UCITS ETF USD Accumulation") sin desbordar.
3. Legible en miniatura (una historia de Instagram se ve pequeña al pasar) y con la marca cúmulo presente pero no invasiva.

## Cómo implementarlo

- Trabaja en una rama nueva: `git checkout -b diseno-share-cards-alt`.
- **No cambies `CardModel` ni los builders** salvo que sea imprescindible (si lo haces, explícalo). Tu código va en archivos nuevos, por ejemplo `src/lib/share-card-styles/<nombre>.ts`, cada uno exportando una función con la misma firma que `renderShareCard`.
- En `src/components/share/share-sheet.tsx`, añade un selector **"Diseño"** (actual + tus propuestas) junto al de tema, recordado en `localStorage` como el tema. Así puedo comparar con la misma tarjeta y los mismos datos.
- Respeta las reglas del repo: TypeScript estricto, sin `number` para importes (en el canvas los números solo sirven para la geometría; las etiquetas salen ya formateadas del modelo).
- Antes de terminar: `pnpm lint && pnpm typecheck && pnpm test`.

## Cómo enseñármelo

- Genera **capturas PNG de cada dirección** (historia y cuadrada, de una posición, la cartera y "tu año"), con datos de ejemplo, en `docs/share-cards/<dirección>/`. Puedes cargarlas en el navegador del panel y guardar el canvas.
- Escribe en `docs/share-cards/PROPUESTAS.md`, por cada dirección: la idea en dos frases, por qué funciona para este público y sus puntos débiles.
- Haz commit en tu rama y **no hagas push ni merge**: elegiré yo.
