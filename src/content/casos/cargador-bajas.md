---
titulo: "Baja automática de indumentaria y equipos en un sistema antiguo"
resumen: "Dar de baja la indumentaria y los equipos asignados al personal se tipeaba a mano en un sistema antiguo, sin API; un programa lo automatizó y logística pudo ponerse al día."
caminos: [logistica]
orden: 3
estado: publicado
resultadoCorto: "El equipo de logística dejó de tipear las bajas a mano y pudo ponerse al día."
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
autoria:
  yo: "Vi el problema desde adentro, porque era parte de mi trabajo en logística. Diseñé cómo tenía que funcionar el programa y verifiqué lo que cargaba."
  ia: "Concebido, diseñado y dirigido por mí; desarrollado con IA."
  verificacion: "Comparé las bajas cargadas por el programa contra el listado de bajas del sistema."
---

## Problema

Cada persona del personal tiene indumentaria y equipos asignados. Darlos de baja, es decir, quitar del sistema todo lo que figuraba a su nombre, se hacía a mano, artículo por artículo, tipeando en los almacenes virtuales de un sistema de gestión antiguo. Ese sistema es de terceros y no tiene API (no ofrece forma de conectarlo con otros programas). Las bajas se acumulaban semana a semana, cada una con muchos artículos, y el equipo de logística no lograba ponerse al día. Además, el tipeo manual favorecía los errores.

## Qué se construyó

Diseñé un programa que hace ese tipeo: toma los datos exportados del sistema de gestión y da de baja lo asignado a cada persona por su cuenta, con mínima intervención. Se detiene y avisa si encuentra una diferencia antes de cargar. Como el sistema no tiene API, el programa funciona por fuera: tipea en él lo mismo que se tipeaba a mano, y no lo modifica.

## Resultado

Con la baja automática, el equipo de logística dejó de tipear las bajas a mano, pudo ponerse al día y su trabajo se simplificó. En las comparaciones que hice contra el listado de bajas del sistema no encontré errores de carga. Lo hice antes de julio de 2026, antes que el cargador de facturas, que siguió el mismo enfoque.
