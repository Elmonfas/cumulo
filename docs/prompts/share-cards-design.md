# Prompt para Claude Design: tarjetas para compartir de cúmulo

Copia todo lo que hay debajo de la línea en Claude Design. Cuando elijas una propuesta, pásale a Claude Code la imagen y le pides que la implemente en `src/lib/share-card.ts`.

---

Diseña las **tarjetas para compartir** de cúmulo, una app de inversión. Son imágenes que el usuario genera desde la app para enseñar su rentabilidad en Instagram Stories, WhatsApp o X. Quiero **3 direcciones visuales distintas** entre sí para elegir una.

## La marca

- **cúmulo**: app para seguir inversiones (acciones, ETF, cripto) pensada para el inversor particular español de 25–40 años. Tono: claro, honesto, «tus inversiones, sin humo». Nada de estética de casino, trading agresivo o cripto-bro.
- **Logotipo**: la palabra «cúmulo» en minúsculas (Geist, peso 500) y un símbolo de diez burbujas de tamaño creciente que dibujan una «c», como un cúmulo de nubes. Color de marca: morado `#7C3AED` (claro) / lila `#A78BFA` (oscuro).
- **Tipografía**: Geist Sans; cifras con números tabulares.
- **Colores** (oscuro / claro):
  - fondo `#0A0A0F` / `#F5F5F8`; superficie `#14141B` / `#FFFFFF`; texto `#F4F4F7` / `#0E0E14`; texto secundario `#8B8A9B` / `#6B6A7A`
  - acento `#A78BFA` / `#7C3AED`
  - subida `#4ADE80` / `#16A34A`; bajada `#F87171` / `#DC2626` (verde y rojo **solo** para subidas y bajadas)
  - series para gráficos de reparto: morado, amarillo `#FACC15`, verde `#34D399`, rosa `#F472B6`, azul `#60A5FA`, naranja `#FB923C`
- **Formato es-ES**: `1.234,56 €`, `+57,6 %`, `−3,6 %`, `19 oct 2026`.

## Formatos

- **Historia 9:16**: 1080 × 1920 px.
- **Cuadrada 1:1**: 1080 × 1080 px (menos contenido: cabecera, cifra protagonista, gráfica pequeña y 2 cifras clave).
- Debe leerse bien **en miniatura**: una historia de Instagram se ve pequeña al pasar.

## Los cuatro tipos de tarjeta y su contenido

Todas llevan: marca cúmulo, fecha, el activo o el título, **una cifra protagonista** con su etiqueta, una línea secundaria, una gráfica y **cifras clave** (hasta 6 en la historia, 2 en la cuadrada).

1. **Posición** (un activo que tienes)
   - Activo: «Vanguard FTSE All-World UCITS ETF» (logo circular de Vanguard) · «Posición · ETF»
   - Protagonista: «Rentabilidad de la posición» **+34,4 %**
   - Secundaria: «Desde 2 sept 2024 · 777 días»
   - Gráfica: precio en línea con área, puntos en las compras (morado) y ventas (rosa), y una línea discontinua amarilla «Mi precio medio · 128,45 €»
   - Cifras: Precio actual 141,20 € · Mi precio medio 128,45 € · Rentabilidad anual +14,6 % · Peso en la cartera 59,5 %

2. **Operación** (una compra o una venta concreta)
   - «Compra · Cripto» · Bitcoin (logo naranja)
   - Protagonista: «Desde que compré» **−1,8 %**
   - Secundaria: «Compré el 14 oct 2026 a 73.616,13 €»
   - Gráfica: precio desde la compra (datos cada hora) con el punto de compra
   - Cifras: Precio de compra 73.616,13 € · Precio hoy 72.290,00 € · Días en cartera 5 · Rentabilidad anual «Menos de 1 año»

3. **Cartera**
   - «Mi cartera» · «3 posiciones» (avatar con el símbolo de cúmulo)
   - Protagonista: «Rentabilidad total» **+19,7 %**
   - Secundaria: «Desde 2 sept 2024»
   - Gráfica: donut de reparto con leyenda: Vanguard FTSE All-World 56 % · Bitcoin 31 % · Amazon 13 %
   - Cifras: Rentabilidad anual +13,6 % · No realizado +19,9 % · Mejor posición AAPL +41,4 % · Peor posición BTC −21,9 %

4. **Tu año**
   - «Mi año» · «Mi 2026 en cúmulo»
   - Protagonista: «Rentabilidad del año hasta hoy» **+8,2 %**
   - Secundaria: «14 compras · 2 ventas»
   - Gráfica: barras por mes (E F M A M J J A S O), verdes las que suben y rojas las que bajan
   - Cifras: Meses aportando 9 de 10 · Racha más larga 6 meses · Mejor mes abr +5,1 % · Mejor compra AMZN +12,3 %

### Privacidad: con y sin importes

Por defecto la tarjeta **no muestra euros de la cartera** (solo porcentajes y precios públicos). Si el usuario activa «Mostrar importes», se añaden dos cifras: «Valor 4.444,44 €» y «Ganancia +1.138,20 €». Cada diseño tiene que verse completo y equilibrado **en los dos casos**.

### Textos largos

Los nombres de fondos pueden ser muy largos («Vanguard FTSE All-World UCITS ETF USD Accumulation»): enseña cómo se cortan o parten sin romper el diseño.

## Qué quiero que me entregues

1. **3 direcciones distintas** (no variaciones de la misma). Algunas ideas, no obligatorias: póster suizo con retícula marcada; ticket o recibo bursátil; gráfica a sangre como protagonista; estilo Apple Wallet/Fitness; tipografía gigante con el número como elemento gráfico.
2. Para cada dirección:
   - la tarjeta de **Posición** en historia y en cuadrada;
   - **Cartera** y **Tu año** en historia;
   - una versión **con importes** de la de Posición;
   - si encaja, variantes de tema (oscuro, claro o con el morado de la marca de fondo).
3. Dos frases por dirección: la idea y por qué funciona para este público.

## Límites técnicos (para que luego se pueda implementar igual)

Las tarjetas se dibujan en el móvil del usuario con Canvas 2D, sin servidor. Así que:
- usa formas, degradados, texto y la gráfica de datos; evita fotos, ilustraciones a mano, texturas complejas o desenfoques de fondo tipo cristal;
- solo la tipografía Geist (cualquier peso);
- los logos de los activos son imágenes pequeñas cuadradas: siempre van dentro de un círculo o un cuadrado redondeado.

Lo que **no** quiero: estética genérica de «dashboard IA» (degradados morados por todas partes, cajas de cristal, brillos neón), ni nada que parezca una app de apuestas.
