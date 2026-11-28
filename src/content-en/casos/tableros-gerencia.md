---
titulo: "Dashboards for management, with numbers that add up"
resumen: "Billing, collections and overdue dashboards for management, in which every breakdown adds up to the total."
caminos: [tecnico]
orden: 5
estado: publicado
resultadoCorto: "In use by management since the second half of 2026."
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
autoria:
  yo: "I defined what management needed to see and verified the numbers."
  ia: "Conceived and designed by me; developed with AI under my direction."
  verificacion: "The automated tests and an automated walkthrough of the 25 pages check that every breakdown adds up to the total; I review the numbers before each delivery."
---

## Problem

Management needed to see billing, collections and overdue balances without having to open or sort the files exported by the management system.

## What was built

- A viewer that takes the files exported by the management system, recognizes what type each one is and cleans them with rules that can be audited.
- 25 pages of billing, collections and overdue dashboards, to see the numbers without opening those files.
- An AI assistant that only writes up numbers that have already been calculated: it calculates nothing.
- Technologies: Python, pandas and Streamlit.

## Honesty rules

These rules let management trust what it sees:

- Every breakdown adds up to the total: "Other" is the remainder, not an estimated number.
- Overdue balances are measured against a cutoff date.
- Every file the viewer generates carries a stamp that makes it reproducible.
- No individual data is sent to the AI.

## Status and result

In use by management since the second half of 2026. Management no longer depends on requesting or sorting the exported files.
