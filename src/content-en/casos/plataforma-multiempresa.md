---
titulo: "Multi-company back end with each company's data isolated"
resumen: "A system for several companies and joint ventures: each one sees only its own data and management sees the whole."
caminos: [tecnico]
orden: 6
estado: publicado
resultadoCorto: "Nine modules in TypeScript and PostgreSQL, with tests that one company cannot see another's data. Not in production."
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
autoria:
  yo: "I defined with management what it had to solve, designed the architecture and verify each delivery with tests."
  ia: "Conceived and designed by me; developed with AI under my direction."
  verificacion: "Automated tests, mutation tests (rules are broken on purpose to check that some test catches it), invariants and documented architecture decisions. Everything is developed with fictitious data."
---

## Problem

Management was spread across several companies and joint ventures, each handled separately. General management asked for a way to bring them together in one place.

## What was built

- Technologies: strict TypeScript, Node.js with Fastify for the API, Next.js for the web app and PostgreSQL, with Row-Level Security so that each entity can read only its own data.
- A multi-company platform: each entity sees only its own data and management sees the whole.
- Nine modules: core, organization, accounting (general ledger), treasury, Argentine taxes, compliance, operations, sales and shared services. Plus an API and a web app.

## How it is verified

- A single command runs the whole check: secrets scan, formatting, types, automated tests, invariants (conditions that must always hold), build and dependency audit. It runs in containers, with its own PostgreSQL database.
- A dedicated set of tests checks that one entity cannot read another entity's data.
- Mutation tests: a rule is broken on purpose in a copy of the code and some test must fail. They run separately, at the close of each stage.
- The API has a written contract (OpenAPI), a versioned baseline, and tests that check that every response complies with it and that a change does not break it.
- The architecture decisions are documented: 33 so far.
- Everything is developed with fictitious data.

## Status

Local development with fictitious data, from 22 September to late October 2026 (latest recorded progress). No production, no cloud and not yet used by the company. It follows the case "Replacing a legacy management system", which was put on hold.

It is described as a reference: because it is a company system, no screenshots, links or data are shown.
