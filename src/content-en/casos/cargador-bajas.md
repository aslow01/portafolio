---
titulo: "Automated write-off loader for logistics"
resumen: "Staff and item write-offs piled up week after week; an automated loader let logistics catch up."
caminos: [logistica]
orden: 3
estado: publicado
resultadoCorto: "The logistics team stopped entering write-offs by hand and was able to catch up."
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
autoria:
  yo: "I saw the problem from the inside, because it was part of my work in logistics. I designed how the loader had to work and verified what it entered."
  ia: "Conceived and designed by me; developed with AI under my direction."
  verificacion: "I compared the write-offs entered by the program against the write-off list in the system."
---

## Problem

Every write-off of staff or items (clothing and equipment) had to be entered by hand, item by item, in the virtual warehouses of the management system. Write-offs piled up week after week, each with many items, and the logistics team could not catch up. Manual entry also invited errors.

## What was built

I designed a loader that takes the data exported from the management system and records the write-offs on its own, with minimal intervention. It stops and warns if it finds a difference before entering. It works outside the management system, which belongs to a third party, and does not modify it.

## Result

With automatic entry, the logistics team stopped entering write-offs by hand and was able to catch up. In the comparisons I made against the system's write-off list I found no entry errors. I did this before July 2026, before the invoice loader, which followed the same approach.
