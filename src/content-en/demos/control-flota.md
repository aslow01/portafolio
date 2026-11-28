---
titulo: "Fleet control"
resumen: "A web application, with fictitious data, to track the document expiry dates of a fleet and the driver’s daily report from the phone. It runs entirely in the browser: it does not connect to any server."
estado: en-vivo
repo: https://github.com/aslow01/demo-control-flota
demo: https://flota.matiasormeno.com.ar
orden: 2
subdominio: flota
stack: ["TypeScript", "Svelte", "Vite"]
# Versión en inglés de src/content/demos/control-flota.md. La captura es la misma (la interfaz de la demo está en español).
laminas:
  - id: alertas
    clara: ../../assets/capturas/flota-alertas-movil-clara.png
    movil:
      clara: ../../assets/capturas/flota-alertas-movil-clara.png
    alt: "The demo’s alert center: 4 critical alerts and 4 vehicles that cannot leave today, each with its reason. Available: 19 of 23."
    pie: "The demo’s alert center, with the example of 23 vehicles."
    procedencia: "Fictitious data."
# El código del extracto es literal (no se traduce): `npm test` lo compara contra el repositorio de la demo.
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
  autoria: "Test developed with AI, under my direction."
  regla: "“Today” is counted in Argentine time: the day changes at 03:00 UTC, not at the server’s midnight. That is why a document that expires today is still valid for that whole day."
  queDice: "At 02:59:59.999 UTC it is still the previous day; at 03:00:00.000 UTC it is already the new day. The tests run in three time zones so this does not break."
  titular: "The day changes at 03:00 UTC"
autoria:
  yo: "I proposed the demo and defined the problem: the paper report gets damaged, takes a long time to fill in and leaves no evidence. I defined the operating rules: the supervisor first sees which vehicle cannot leave, and the driver checks the vehicle on the phone before leaving. A vehicle that is out of service, has expired documents or has a driver without a valid license does not leave. “Close early”, “until tomorrow” and “one vehicle per driver” are rules, and the check includes four mining-specific points. I chose the technology by comparing alternatives and required destructive tests at every stage, without moving on while errors were open."
  ia: "Conceived and designed by me; developed with AI under my direction. AI agents also carried out the code reviews, the destructive tests and the accessibility audit."
---

Tracks the expiry dates of a fleet’s documents (insurance, technical inspection, permits) and the daily report the driver fills in from the phone. When opened, it says which vehicles cannot leave today and why. The driver does a 14-point check before leaving, four of them for mining, and if the vehicle’s insurance or another mandatory document has expired, the driver cannot submit it. It runs entirely in the browser: the page cannot connect to any server.

All the demo’s data is fictitious (companies, tax IDs, people and amounts).
