---
titulo: "Collections dashboard"
resumen: "Billing, collections and overdue balances, with drill-down to the individual document. Fictitious data."
estado: en-vivo
repo: https://github.com/aslow01/demo-tablero-gestion
demo: https://tablero.matiasormeno.com.ar
orden: 3
subdominio: tablero
stack: ["TypeScript", "Svelte", "Vite"]
# Versión en inglés de src/content/demos/tablero-gestion.md. La captura es la misma (su texto está en español).
laminas:
  - id: resumen
    clara: ../../assets/capturas/tablero-resumen-clara.png
    alt: "Screenshot of the demo: card “Posición al 31/10/2026” (position as of Oct 31, 2026). Overdue: $6,306,481.28 (22.1% of what is receivable, across 6 clients); balance receivable: $28,513,662.10, and its bar by days overdue."
    pie: "The demo’s collections summary, with the cutoff date of Oct 31, 2026."
    procedencia: "Screenshot of the demo, built from scratch with fictitious data."
autoria:
  yo: "I defined the scope and rules of the dashboard: the cutoff date can only be a month-end, due dates are counted in calendar days with no holidays, and billing is shown without VAT while balances are shown with VAT, with the label on screen. I decided that the closing check stays in the tests and not on screen. I reviewed the amounts and found them plausible."
  ia: "Conceived by me; specification, code and tests developed with AI under my direction."
  verificacion: "Each figure is calculated by two independent routes that must match, and the tests check it. An independent calculation repeats the measurements, and a mutation test plants 60 changes in the code that the tests must detect."
---

Answers three questions: how much was billed, how much was collected, and who owes what and since when. Every number opens down to the documents that make it up. It is the dashboard of a fictitious fleet-services company, with a cutoff date you can change. It runs entirely in the browser: it has no server, no login and no file upload.

**How the figures are kept consistent.** Each figure is obtained by two separate routes: one sums the raw data and the other lists document by document. If they do not match, the screen shows an error instead of the number. Source: README of the demo’s repository.

All the demo’s data is fictitious (companies, tax IDs, people and amounts).
