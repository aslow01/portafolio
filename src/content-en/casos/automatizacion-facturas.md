---
titulo: "Automating invoice entry"
resumen: "A loader custom-built for the company, which reconciles invoices against ARCA (Argentina’s tax authority), checks each document before saving it and stops at any difference."
caminos: [tecnico, logistica]
orden: 2
estado: publicado
resultadoCorto: "In daily use: more than 2,000 documents per month."
regla: "It stops at any difference, however small. Nothing is saved without human approval."
uso: "Daily, more than 2,000 documents per month"
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
lineaObra: "In daily use: more than 2,000 documents per month, at a private security company in San Juan, Argentina."
resultado:
  cifra: "40 → 300+"
  unidad: "invoices per workday"
  medicion: "Averages per workday, October 2026. The 300+ days also include payment orders: it is not a cap."
demo: lector-facturas
destacado: true
autoria:
  yo: "I analyzed the problem with management and the accounting department, designed the workflow (reconciliation, proposal, approval, loading and control) and I defined the control rules: what is checked, when to stop and what a person always decides."
  ia: "Conceived and designed by me; developed with AI under my direction."
  verificacion: "The program compares every piece of entered data with the document, including the total against ARCA to the cent, and stops at any difference. When it finishes, it searches again for each invoice to confirm it was saved exactly once. Nothing is entered without human approval. I defined the control criteria as I saw the results. During the first weeks I manually compared every entered document against the originals."
---

## Problem

When I moved into administration, at the request of management and the accounting department, the team was far behind. Purchase invoices were entered by hand into the management system (ERP), one by one: there were wrong dates and amounts, documents entered twice and others that had never been entered. Nobody could say with certainty what was missing.

## What was built

A desktop program for the administration team, which works alongside the ERP without modifying it:

- **Daily reconciliation.** It matches the received documents published by ARCA against what is already entered in the ERP and shows what is missing, with its amount.
- **Proposal from history.** For each invoice it proposes the expense, the cost center and the taxes based on how that supplier has always been entered. If the history is consistent, the invoice is ready; if not, it goes to review with its confidence level and an explanation of why that is proposed. If the supplier is new, a person fills it in and can save it as a rule for the next ones.
- **Local AI as a second opinion.** When the proposal is doubtful, an AI that runs in the office, without sending data out, reads the document and suggests an allocation. It only fills in the form: it never approves or saves. It also answers team questions about suppliers and previous entries.
- **Automatic entry in the ERP.** It enters each approved invoice on the ERP screen, the way a person would.
- **Beyond invoices.** Over time other expenses were added (receipts, travel allowances), payment orders with double-payment control and a shared payment log that replaced the spreadsheet.

## How it is controlled

There was a single design principle: **the program never saves anything that does not match.** Since automating another program's screen is fragile, every session starts with a test entry and, at any difference, it stops.

- Before each invoice it searches the ERP to see whether it already exists, including under another supplier's name.
- After entering it, it reads the screen and compares every piece of data, including the total against ARCA, with no tolerance. At any difference it stops and does not continue with the others.
- When it finishes, it searches again for each invoice to confirm it was saved exactly once.
- Every session starts with a test entry that is discarded, to check that the screen is in working order.
- Nothing is entered without human approval. An invoice can be held with its reason, and a "do not pay" list blocks the orders that require authorization.
- Several people work at the same time without getting in each other's way: each invoice in progress is reserved for whoever is entering it, and an activity log that cannot be erased records who did what and when.
- A complete user guide and a suggestion box, with status and reply, so the team can ask for improvements.

## Catching up on invoicing

Besides the loader, I brought purchase invoicing up to date from January to October 2026. I reviewed the invoices and the payment orders against each other, and corrected and re-entered what was needed. I applied the accounting department's allocation criteria, based on short accounting courses. The AI processed the documents and flagged the differences; I reviewed each one. It took about a month. As a final check, each month's totals match to the cent the received documents published by ARCA: no invoices are missing and none are extra.

## Result

I started development in July 2026, before moving into administration, and the program has been in daily use since August 2026. Today it enters more than 2,000 documents per month with their payment orders, and I check the result. The average of 300 is per workday, not a cap: the month's total is set by what arrives, and not every day is an entry day. The administration team uses it every day, even when its author is not there.
