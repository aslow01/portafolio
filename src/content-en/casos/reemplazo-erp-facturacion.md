---
titulo: "Replacing a legacy management system"
resumen: "Before building, three feasibility tests; then, a new system with payroll, data migration and electronic invoicing."
caminos: [tecnico]
orden: 4
estado: publicado
resultadoCorto: "The three tests gave a favorable result; the system was put on hold without ever going into use."
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
autoria:
  yo: "I defined the feasibility tests and what had to be met to call them good, and I verified the results."
  ia: "Conceived and designed by me; developed with AI under my direction."
  verificacion: "The migration passes 275 of 275 reconciliation checks between the old and the new system, CAEs (electronic invoice authorization codes) were obtained in ARCA’s (Argentina’s tax authority) test environment, and the system has automated tests."
---

## Problem

The company manages several companies, and the management system it used was old, limited and closed. I proposed replacing it on my own initiative: nobody asked me to. Replacing it was a big risk: if the new system did not keep the data, did not isolate each company from the others or did not issue invoices, it was useless.

## What was built

- **First, three feasibility tests**, before writing the system: that the data migration would reconcile, that each company would be isolated from the others, and that electronic invoicing would work in ARCA's test environment (homologation).
- **Then, a multi-company system** with a payroll engine, data migration from the previous system and electronic invoicing.
- It includes local AI to query the system's data.
- Technologies: TypeScript, Next.js and PostgreSQL; Python for the migration.

## Result

The three tests gave a favorable result. I started the system in the first half of 2026 and it was put on hold without ever going into use: the work continued on a multi-company platform, which is now in development.

## What I learned

Midway through the project I noticed that most of the recent decisions were technical rather than product decisions: there was no plan for what to build and when to call something finished. I put together a master plan with versions and a definition of done for each.
