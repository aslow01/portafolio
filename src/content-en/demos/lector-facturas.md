---
titulo: "Invoice reader and reconciler"
resumen: "Matches the electronic invoices received against what is entered in the management system and tells you which ones are missing, which were entered incorrectly and which appear twice. Runs in the browser, with fictitious data."
estado: en-vivo
repo: https://github.com/aslow01/demo-lector-facturas
demo: https://facturas.matiasormeno.com.ar
orden: 1
subdominio: facturas
stack: ["TypeScript", "Vite", "pdf.js", "jsQR"]
caso: automatizacion-facturas
# Versión en inglés de src/content/demos/lector-facturas.md. Las capturas son las mismas (la interfaz de la demo está en español).
laminas:
  - id: celular
    clara: ../../assets/capturas/lector-r3-clara.png
    alt: "Phone screen: the Result window (“Resultado”) with the invoices to enter, a button to see them in the spreadsheet, and the list of items needing attention in one column."
    pie: "The demo on a phone 360 pixels wide."
    procedencia: "Fictitious data."
  - id: atencion
    clara: ../../assets/capturas/lector-atencion-clara.png
    alt: "Screenshot of the demo, “Requieren atención” list (needs attention): 3 to review, 2 entered incorrectly, 1 duplicated in the spreadsheet, 1 entered twice in the system and 2 entered in the system but not received."
    pie: "What the demo asks you to review."
    procedencia: "Screenshot of the demo, built from scratch with fictitious data."
# El código del extracto es literal (no se traduce): `npm test` lo compara contra el repositorio de la demo.
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
  autoria: "I defined the rule; the test was developed with AI and I reviewed it."
  regla: "If an invoice is in the system with a different amount, it does not count as entered: the demo flags it “Mal cargada: otro importe” (entered incorrectly: different amount) and shows both amounts and the difference."
  queDice: "An amount of $1,000.00 against $1,000.01 is a “different amount”; the sum 0.1 + 0.2 against 0.3 is not treated as a difference."
  titular: "No tolerance on the amount"
autoria:
  yo: "I decided that the matching would be a fixed rule with no AI, that it would not include tax rules, and how the tool is presented: few windows, and a guide that never opens by itself."
  ia: "Conceived by me; developed with AI under my direction."
  verificacion: "Automated tests for each matching rule. For example, a one-cent difference in the amount is enough to flag the invoice as “Mal cargada: otro importe” (entered incorrectly: different amount)."
---

Reads Argentine electronic invoices (PDF or image with the QR code from ARCA, Argentina’s tax authority), matches them against a file exported from the management system and says, document by document, what is still to be entered, what is already entered, what was entered incorrectly and what appears twice. It runs in the browser: files are not sent to any server.

All the demo’s data is fictitious (companies, tax IDs, people and amounts).
