# IDEAS

Ideas fuera del alcance de la fase en curso. Nada de esto se implementa hasta que se pida.

- Recordar los últimos datos de la calculadora de interés compuesto entre visitas.
- Exportar la tabla año a año del interés compuesto a CSV.
- Importador: elegir manualmente el activo cuando el ISIN no se encuentra, en vez de crearlo como manual.
- Guardar el histórico de precios en IndexedDB para ver las gráficas sin conexión.
- Volver a armar una alerta cumplida con un toque.
- Renta: arrastrar las pérdidas pendientes de años anteriores y la deducción por doble imposición internacional.
- Importador genérico de CSV (otros brókers) con plantilla descargable.
- Objetivos: tarjeta para compartir el progreso y objetivos de un activo concreto (no solo de toda la cartera).
- Importador TR: desdoblamientos (CORPORATE_ACTION/SPLIT) conservando las fechas de compra FIFO.
- Importador TR: devoluciones de capital (DIVIDEND_EQUIVALENT_PAYMENT), que reducen el coste de adquisición en vez de tributar.
- Importador TR: redondeos (round-up), que no aparecen en ninguna fuente pública; verificar con una exportación real.
- Importador TR: confirmar con una cuenta española cómo llegan las retenciones de dividendos e intereses (¿retiene TR España el 19 %?).
- Importador TR: tipos de efectivo nombrados por Portfolio Performance sin filas de ejemplo (BONUS, REFERRAL, STOCKPERK…).
- Renta: deducción por doble imposición país por país y tabla de tipos de convenio (hoy 15 % para todos).
- Renta: añadir intereses a mano desde el formulario de operaciones.

## Última versión: app nativa en la App Store

Cuando cúmulo se lance de verdad, no antes. Plan: envolver la web actual con **Capacitor** (de 1 a 3 semanas hasta revisión), reutilizando casi todo el código y con los datos todavía solo en el dispositivo.

- **Requisitos**: cuenta de Apple Developer (99 $/año), Mac con Xcode y política de privacidad publicada.
- **Funciones nativas** (para pasar la norma 4.2 de Apple, que rechaza las webs empaquetadas):
  - Notificaciones nativas (APNs), sin el «from cúmulo» que iOS añade a las webs instaladas.
  - Extensión de «Compartir»: exportar el CSV en Trade Republic → Compartir → cúmulo, y se importa solo.
  - Widget en la pantalla de inicio con el valor de la cartera (WidgetKit, en Swift).
  - Bloqueo con Face ID al abrir la app.
- **Riesgos**:
  - Revisión de Apple: describirla como herramienta de seguimiento personal, no como servicio financiero, o podría pedir que la publique una empresa.
  - Los precios siguen saliendo de `/api/*` en Vercel, que debe estar siempre en marcha.
- **Descartado por ahora**: rehacerla en React Native o Swift (meses de trabajo). Solo si la app tiene tirón.
