---
titulo: "Control de flota"
resumen: "Una aplicación web, con datos ficticios, para controlar los vencimientos de documentos de una flota y el parte diario del conductor desde el celular. Funciona entera en el navegador: no se conecta a ningún servidor."
# En vivo desde el 25/11/2026 (decisión de Matías): enlace a la demo y al código público. Sin aviso de «interfaz en rediseño»:
# la interfaz nueva se publica junto con la web.
estado: en-vivo
repo: https://github.com/aslow01/demo-control-flota
demo: https://flota.matiasormeno.com.ar
orden: 2
subdominio: flota
stack: ["TypeScript", "Svelte", "Vite"]
# Captura real de la demo, en tema claro, con los datos ficticios que trae. Se sacó el 25/11/2026
# de la demo en vivo (repositorio de la demo en el commit 957c214), a 360 px de ancho, sin retoques. La ficha solo muestra esta captura
# (la demo se ve en el teléfono), así que la de escritorio no se guarda: clara y movil apuntan al mismo archivo.
laminas:
  - id: alertas
    clara: ../../assets/capturas/flota-alertas-movil-clara.png
    # Recorte para pantallas angostas: la demo vista a 360 px de ancho (a 1025 px el texto no se lee reducido).
    movil:
      clara: ../../assets/capturas/flota-alertas-movil-clara.png
    alt: "Centro de alertas de la demo: 4 alertas críticas y 4 unidades que no pueden salir hoy, cada una con su motivo. Disponibles: 19 de 23."
    pie: "El centro de alertas de la demo, con el ejemplo de 23 unidades."
    procedencia: "Datos inventados."
# Extracto de una prueba real de la demo: texto literal de tests/fechas.test.ts. `npm test` lo compara contra los repositorios de la demo (trabajo y público; ver el README) y falla si difiere.
# Sin `commit`: el historial del repositorio se reescribe antes de publicarlo y el hash cambiaría; se compara con la carpeta.
prueba:
  archivo: "tests/fechas.test.ts"
  desde: 20
  hasta: 26
  codigo: |
    it("T1: 02:59:59.999Z todavía es el día anterior", () => {
      expect(hoyEnArgentina(new Date("2026-11-18T02:59:59.999Z"))).toBe("2026-11-17");
    });

    it("T1: 03:00:00.000Z ya es el día nuevo", () => {
      expect(hoyEnArgentina(new Date("2026-11-18T03:00:00.000Z"))).toBe("2026-11-18");
    });
  autoria: "Prueba desarrollada con IA, bajo mi dirección."
  regla: "«Hoy» se cuenta en hora argentina: el día cambia a las 03:00 UTC, no a la medianoche del servidor. Por eso un documento que vence hoy todavía vale durante todo ese día."
  queDice: "A las 02:59:59.999 UTC todavía es el día anterior; a las 03:00:00.000 UTC ya es el día nuevo. Las pruebas se corren en tres zonas horarias para que esto no se rompa."
  titular: "El día cambia a las 03:00 UTC"
autoria:
  yo: "Propuse la demo y definí el problema: el parte en papel se daña, tarda en completarse y no deja evidencia. Definí las reglas de operación: el encargado ve primero qué unidad no puede salir, y el conductor revisa la unidad en el celular antes de salir. Una unidad fuera de servicio, con documentación vencida o con un conductor sin licencia vigente no sale. «Cerrar antes», «hasta mañana» y «una unidad por conductor» son reglas, y la revisión incluye cuatro puntos propios de minería. Elegí la tecnología comparando alternativas y exigí pruebas destructivas en cada etapa, sin avanzar con errores abiertos."
  ia: "Concebida, diseñada y dirigida por mí; desarrollada con IA. Agentes de IA hicieron además las revisiones de código, las pruebas destructivas y la auditoría de accesibilidad."
---

Controla los vencimientos de los documentos de una flota (seguro, revisión técnica, habilitaciones) y el parte diario que completa el conductor desde el celular. Al abrirla dice qué unidades no pueden salir hoy y por qué. El conductor hace una revisión de 14 puntos antes de salir, cuatro de ellos de minería, y si la unidad tiene el seguro u otro documento obligatorio vencido, no puede enviarla. Funciona entera en el navegador: la página no puede conectarse a ningún servidor.

Todos los datos de la demo son ficticios (empresas, identificaciones fiscales, personas y montos).
