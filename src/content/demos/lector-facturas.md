---
titulo: "Lector y conciliador de facturas"
resumen: "Cruza las facturas electrónicas recibidas con lo cargado en el sistema de gestión y dice cuáles faltan cargar, cuáles están mal cargadas y cuáles figuran dos veces. Corre en el navegador, con datos ficticios."
estado: en-vivo
repo: https://github.com/aslow01/demo-lector-facturas
demo: https://facturas.matiasormeno.com.ar
orden: 1
subdominio: facturas
stack: ["TypeScript", "Vite", "pdf.js", "jsQR"]
caso: automatizacion-facturas
# Láminas: capturas reales de la demo, en tema claro y con los datos ficticios que trae. `celular` va junto a la ficha y
# `atencion` en la portada. `movil` (opcional) es el recorte para pantallas angostas.
# La `procedencia` ya no dice "en desarrollo" (publicada el 25/11/2026), así que no cambió.
laminas:
  - id: celular
    clara: ../../assets/capturas/lector-r3-clara.png
    alt: "Pantalla de un teléfono: la ventana Resultado con las facturas por cargar, un botón para verlas en la planilla y la lista de atención en una columna."
    pie: "La demo en un teléfono de 360 píxeles de ancho."
    procedencia: "Datos inventados."
  - id: atencion
    clara: ../../assets/capturas/lector-atencion-clara.png
    alt: "Captura de la demo, lista Requieren atención: 3 para revisar, 2 mal cargadas, 1 duplicada en la planilla, 1 cargada dos veces en el sistema y 2 cargadas en el sistema y no recibidas."
    pie: "Lo que la demo pide revisar."
    procedencia: "Captura de la demo, escrita desde cero con datos inventados."
# Extracto de una prueba real de la demo: texto literal de tests/conciliacion.test.ts. `npm test` lo compara contra los repositorios de la demo (trabajo y público; ver el README) y falla si difiere.
# `commit` (opcional): hash del commit donde están esas líneas; si se escribe, la comparación se hace contra ese commit.
prueba:
  archivo: "tests/conciliacion.test.ts"
  desde: 255
  hasta: 278
  codigo: |
    it("el importe se compara exacto al centavo: sin tolerancia", () => {
      expect(
        resultadoUnico(planilla({ importe: 1000 }), [
          registro({ importe: 1000.01 }),
        ]),
      ).toMatchObject({ tipo: "otro-importe" });
      expect(
        resultadoUnico(planilla({ importe: 1000 }), [
          registro({ importe: 999.99 }),
        ]),
      ).toMatchObject({ tipo: "otro-importe" });
      // Los errores de coma flotante no cuentan como diferencia:
      // se compara en centavos enteros.
      expect(
        resultadoUnico(planilla({ importe: 0.1 + 0.2 }), [
          registro({ importe: 0.3 }),
        ]),
      ).toEqual({ tipo: "ya-cargada" });
      expect(
        resultadoUnico(planilla({ importe: 118470.5 }), [
          registro({ importe: 118470.5 }),
        ]),
      ).toEqual({ tipo: "ya-cargada" });
    });
  autoria: "La regla la definí yo; la prueba se desarrolló con IA y la revisé yo."
  regla: "Si una factura figura en el sistema con otro importe, no cuenta como cargada: la demo la marca “Mal cargada: otro importe” y muestra ambos importes y la diferencia."
  queDice: "Un importe de $ 1.000,00 contra otro de $ 1.000,01 es “otro importe”; la suma 0,1 + 0,2 contra 0,3 no se toma como diferencia."
  titular: "El importe se compara sin tolerancia"
autoria:
  yo: "Decidí que el cruce sea una regla fija y sin IA, que no incluya reglas fiscales y cómo se presenta la herramienta: pocas ventanas, y una guía que nunca se abre sola."
  ia: "Concebida y dirigida por mí; desarrollada con IA."
  verificacion: "Pruebas automáticas de cada regla de cruce. Por ejemplo, un centavo de diferencia en el importe alcanza para marcar la factura como \"Mal cargada: otro importe\"."
---

Lee facturas electrónicas argentinas (PDF o imagen con el código QR de ARCA), las cruza con un archivo exportado del sistema de gestión y dice, comprobante por comprobante, qué falta cargar, qué ya está cargado, qué está mal cargado y qué figura dos veces. Corre en el navegador: los archivos no se envían a ningún servidor.

Todos los datos de la demo son ficticios (empresas, identificaciones fiscales, personas y montos).
