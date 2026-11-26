---
titulo: "Reemplazo de un sistema de gestión antiguo"
resumen: "Antes de construir, tres pruebas de viabilidad; después, un sistema nuevo con sueldos, migración de datos y facturación electrónica."
caminos: [tecnico]
orden: 4
estado: publicado
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
autoria:
  yo: "Definí las pruebas de viabilidad y qué se tenía que cumplir para darlas por buenas, y verifiqué los resultados."
  ia: "Concebido, diseñado y dirigido por mí; desarrollado con IA."
  verificacion: "La migración pasa 275 de 275 controles de cuadre entre el sistema anterior y el nuevo, se obtuvieron CAE en homologación de ARCA y el sistema tiene pruebas automáticas."
---

## Problema

La empresa administra varias sociedades, y el sistema de gestión que usaba era antiguo, limitado y cerrado. Propuse reemplazarlo por mi cuenta: nadie me lo pidió. Reemplazarlo era un riesgo grande: si el sistema nuevo no conservaba los datos, no aislaba a cada empresa de las demás o no facturaba, no servía.

## Qué se construyó

- **Primero, tres pruebas de viabilidad**, antes de escribir el sistema: que la migración de datos cuadrara, que cada empresa quedara aislada de las demás y que la facturación electrónica funcionara en el ambiente de pruebas (homologación) de ARCA.
- **Después, un sistema multiempresa** con motor de sueldos, migración de datos desde el sistema anterior y facturación electrónica.
- Incluye IA local para consultar los datos del sistema.
- Tecnologías: TypeScript, Next.js y PostgreSQL; Python para la migración.

## Resultado

Las tres pruebas dieron resultado favorable. Empecé el sistema en el primer semestre de 2026 y quedó en pausa sin llegar a usarse: el trabajo siguió en una plataforma multiempresa, que hoy está en desarrollo.

## Qué aprendí

A mitad del proyecto detecté que la mayoría de las últimas decisiones eran técnicas y no de producto: faltaba un plan de qué construir y cuándo dar algo por terminado. Armé un plan maestro con versiones y un criterio de listo para cada una.
