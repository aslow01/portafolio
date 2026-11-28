---
titulo: "Backend multiempresa con los datos de cada empresa aislados"
resumen: "Un sistema para varias sociedades y uniones transitorias: cada una ve solo sus datos y la gerencia ve el conjunto."
caminos: [tecnico]
orden: 6
estado: publicado
resultadoCorto: "Nueve módulos en TypeScript y PostgreSQL, con pruebas de que una empresa no ve los datos de otra. Sin producción."
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
autoria:
  yo: "Definí con la gerencia qué debía resolver, diseñé la arquitectura y verifico cada entrega con pruebas."
  ia: "Concebido, diseñado y dirigido por mí; desarrollado con IA."
  verificacion: "Pruebas automáticas, pruebas de mutación (se rompen reglas a propósito para comprobar que alguna prueba lo detecta), invariantes y decisiones de arquitectura documentadas. Todo se desarrolla con datos ficticios."
---

## Problema

La gestión estaba repartida entre varias sociedades y uniones transitorias de empresas, cada una por separado. La gerencia general pidió una forma de reunirlas en un solo lugar.

## Qué se construyó

- Tecnologías: TypeScript estricto, Node.js con Fastify en la API, Next.js en la web y PostgreSQL, con Row-Level Security (seguridad por filas) para que cada entidad solo pueda leer sus propios datos.
- Una plataforma multiempresa: cada entidad ve solo lo suyo y la gerencia ve el conjunto.
- Nueve módulos: núcleo, organización, contabilidad (libro mayor), tesorería, impuestos de Argentina, cumplimiento, operaciones, comercial y servicios comunes. Además, una API y una web.

## Cómo se verifica

- Un solo comando corre toda la verificación: revisión de secretos, formato, tipos, pruebas automáticas, invariantes (condiciones que siempre deben cumplirse), compilación y auditoría de dependencias. Corre en contenedores, con una base PostgreSQL propia.
- Un conjunto de pruebas específico comprueba que una entidad no pueda leer los datos de otra.
- Pruebas de mutación: se rompe una regla a propósito en una copia del código y se exige que alguna prueba falle. Se corren aparte, al cerrar cada tramo.
- La API tiene un contrato escrito (OpenAPI), una línea de base versionada y pruebas que verifican que cada respuesta lo cumple y que un cambio no lo rompe.
- Las decisiones de arquitectura están documentadas: 33 hasta hoy.
- Todo se desarrolla con datos ficticios.

## Estado

Desarrollo local con datos ficticios, del 22 de septiembre a fines de octubre de 2026 (último avance registrado). Todavía sin producción, sin nube y sin uso en la empresa. Sucede al caso «Reemplazo de un sistema de gestión antiguo», que quedó en pausa.

Se describe como referencia: por tratarse de un sistema de la empresa, no se muestran capturas, enlaces ni datos.
