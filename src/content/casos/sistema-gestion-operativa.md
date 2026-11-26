---
titulo: "Partes diarios, flota y asistencia en un solo sistema"
resumen: "Una web administrativa y dos apps móviles, una de logística y otra de asistencia, para sacar la operación diaria de los correos y las planillas."
caminos: [logistica, tecnico]
corte: 5
orden: 1
estado: publicado
uso: "Diario, desde el primer semestre de 2026"
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
lineaObra: "En uso diario desde el primer semestre de 2026, en una empresa de seguridad privada de San Juan."
resultado:
  cifra: "Partes cargados en la app"
  unidad: "en lugar de enviarse por correo"
  medicion: "Antes llegaban a la oficina con días de demora; hoy se cargan con lista de control, kilómetros y fotos. Comparación con el trabajo anterior, sin medición en números."
autoria:
  yo: "Decidí qué módulos tenía el sistema, qué hace cada uno y cómo se usan. Propuse cómo se reparten los permisos y la gerencia lo aprobó."
  ia: "Concebido, diseñado y dirigido por mí; desarrollado con IA, pruebas incluidas."
  verificacion: "Probé las apps en el celular y después las probaron quienes las iban a usar. Revisé qué casos cubrían las pruebas automáticas. Al asistente con IA lo probé con casos de acceso indebido, como un usuario que pide un dato que no le corresponde ver."
---

## Problema

Cuando trabajaba en logística, la operación diaria (partes de las unidades, flota, documentación y asistencia) se manejaba con correos y planillas. Los partes llegaban a la oficina con días de demora, y la información se perdía.

## Cómo empezó

Lo armé a comienzos de 2026 para ordenar mi propio trabajo en logística. Después se extendió a otras áreas.

## Qué se construyó

Un sistema con un único servidor y tres puntos de acceso: una web administrativa y dos apps móviles, una de logística y otra de asistencia.

- **Partes diarios** con lista de control, kilómetros y fotos, con exportación a PDF.
- **Flota y documentación** con alertas de vencimientos y ubicación de las unidades por GPS.
- **Asistencia** con verificación de ubicación desde el celular.
- **Acceso y permisos:** ingreso con doble factor, permisos por rol y registro de quién hizo qué y cuándo.
- **Asistente con IA** con consultas propias que filtran los datos según el rol de quien pregunta.
- **Tecnologías:** React en la web, Flutter en las apps, y Node.js con PostgreSQL en el servidor.

## Estado y resultado

En uso diario desde el primer semestre de 2026, mientras se extiende al resto de las áreas. Lo mantengo yo.

Lo que cambió: los partes diarios, que llegaban con días de demora por correos y planillas, ahora se cargan con lista de control, kilómetros y fotos.
