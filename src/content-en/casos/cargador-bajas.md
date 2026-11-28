---
titulo: "Automated uniform and equipment unassignment in a legacy system"
resumen: "Unassigning staff uniforms and equipment meant typing everything by hand into a legacy system with no API; a program now does it, and logistics caught up."
caminos: [logistica]
orden: 3
estado: publicado
resultadoCorto: "The logistics team stopped typing the unassignments by hand and was able to catch up."
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
autoria:
  yo: "I saw the problem from the inside, because it was part of my work in logistics. I designed how the program had to work and verified what it entered."
  ia: "Conceived and designed by me; developed with AI under my direction."
  verificacion: "I compared the unassignments entered by the program against the unassignment list in the system."
---

## Problem

Each member of staff has uniforms and equipment assigned to them. Unassigning them, meaning removing everything recorded under their name, was done by hand, item by item, by typing into the virtual warehouses of a legacy management system. The system belongs to a third party and has no API (no way to connect other programs to it). Unassignments piled up week after week, each with many items, and the logistics team could not catch up. Typing by hand also invited errors.

## What was built

I designed a program that does that typing: it takes the data exported from the management system and unassigns everything on its own, with minimal intervention. It stops and warns if it finds a difference before entering anything. Because the system has no API, the program works from the outside: it types into the system what used to be typed by hand, and does not modify it.

## Result

With automatic unassignment, the logistics team stopped typing by hand, caught up, and its work became simpler. In the comparisons I made against the system's unassignment list I found no entry errors. I did this before July 2026, before the invoice loader, which followed the same approach.
