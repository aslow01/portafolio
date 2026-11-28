---
titulo: "Daily reports, fleet and attendance in one system"
resumen: "A web admin panel and two mobile apps, one for logistics and one for attendance, to take daily operations out of emails and spreadsheets."
caminos: [logistica, tecnico]
corte: 5
orden: 1
estado: publicado
resultadoCorto: "In daily use since the first half of 2026: reports entered in the app instead of being sent by email."
uso: "Daily, since the first half of 2026"
contexto: "Private security company in San Juan, Argentina"
rol: "Design, direction and verification"
lineaObra: "In daily use since the first half of 2026, at a private security company in San Juan, Argentina."
resultado:
  cifra: "Reports entered in the app"
  unidad: "instead of being sent by email"
  medicion: "They used to reach the office days late; today they are entered with a checklist, mileage and photos. Comparison with the previous way of working, not measured in numbers."
autoria:
  yo: "I decided which modules the system had, what each one does and how they are used. I proposed how permissions are divided and management approved it."
  ia: "Conceived and designed by me; developed with AI under my direction, tests included."
  verificacion: "I tested the apps on a phone, and then the people who were going to use them tested them. I reviewed which cases the automated tests covered. I tested the AI assistant with improper-access cases, such as a user asking for data they are not allowed to see."
---

## Problem

When I worked in logistics, daily operations (vehicle reports, fleet, documentation and attendance) were handled with emails and spreadsheets. Reports reached the office days late, and information got lost.

## How it started

I built it in early 2026 to organize my own work in logistics. It later spread to other departments.

## What was built

A system with a single server and three entry points: a web admin panel and two mobile apps, one for logistics and one for attendance.

- **Daily reports** with a checklist, mileage and photos, with PDF export.
- **Fleet and documentation** with expiry alerts and GPS location of the vehicles.
- **Attendance** with location check from the phone.
- **Access and permissions:** sign-in with two-factor authentication, role-based permissions and a log of who did what and when.
- **AI assistant** with its own queries that filter the data according to the role of the person asking.
- **Technologies:** React on the web, Flutter in the apps, and Node.js with PostgreSQL on the server.

## Status and result

In daily use since the first half of 2026, while it extends to the remaining departments. I maintain it.

What changed: the daily reports, which used to arrive days late through emails and spreadsheets, are now entered with a checklist, mileage and photos.
