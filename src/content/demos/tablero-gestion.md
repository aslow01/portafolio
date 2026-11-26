---
titulo: "Tablero de cobranzas"
resumen: "Facturación, cobranzas y mora con desglose hasta el comprobante. Datos ficticios."
estado: en-vivo
repo: https://github.com/aslow01/demo-tablero-gestion
demo: https://tablero.matiasormeno.com.ar
orden: 3
subdominio: tablero
stack: ["TypeScript", "Svelte", "Vite"]
# Lámina: captura real de la demo, en tema claro y con sus datos ficticios, sin retoques. Es un recorte cuadrado (1098 × 1098 px,
# a 3x) de la demo en diseño de celular (390 px de ancho): la tarjeta «Posición al 31/10/2026», de la mora al saldo y su barra
# por días de atraso. Cuadrado para que encaje en la caja de la ficha (casi cuadrada en escritorio) sin cortar palabras.
laminas:
  - id: resumen
    clara: ../../assets/capturas/tablero-resumen-clara.png
    alt: "Captura de la demo: tarjeta «Posición al 31/10/2026». En mora $ 6.306.481,28 (22,1 % de lo que hay por cobrar, en 6 clientes); saldo a cobrar $ 28.513.662,10 y su barra según días de atraso."
    pie: "El resumen de cobranzas de la demo, con la fecha de corte del 31/10/2026."
    procedencia: "Captura de la demo, escrita desde cero con datos inventados."
autoria:
  yo: "Definí el alcance y las reglas del tablero: la fecha de corte se elige solo en cierres de mes, los vencimientos se cuentan en días corridos y sin feriados, y la facturación se muestra sin IVA y los saldos con IVA, con el rótulo en pantalla. Decidí que el control de cierre quede en las pruebas y no en pantalla. Revisé los importes y los consideré plausibles."
  ia: "Concebido y dirigido por mí; especificación, código y pruebas desarrollados con IA."
  verificacion: "Cada cifra se calcula por dos caminos independientes que tienen que coincidir, y las pruebas lo comprueban. Un cálculo independiente repite las medidas y una prueba de mutaciones planta 60 cambios en el código que las pruebas tienen que detectar."
---

Responde tres preguntas: cuánto se facturó, cuánto se cobró y quién debe, desde cuándo. Cada número se abre hasta los comprobantes que lo componen. Es el tablero de una empresa ficticia de servicios de flota, con una fecha de corte que se puede cambiar. Funciona entero en el navegador: no tiene servidor, inicio de sesión ni carga de archivos.

**Cómo se cuida que las cifras cierren.** Cada cifra se obtiene por dos caminos separados: uno suma los datos crudos y el otro lista comprobante por comprobante. Si no coinciden, la pantalla muestra un error y no el número. Fuente: README del repositorio de la demo.

Todos los datos de la demo son ficticios (empresas, identificaciones fiscales, personas y montos).
