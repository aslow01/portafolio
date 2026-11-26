---
titulo: "Cargador automático de bajas en logística"
resumen: "Las bajas de personal y de artículos se acumulaban semana a semana; un cargador automático permitió a logística ponerse al día."
caminos: [logistica]
orden: 3
estado: publicado
resultadoCorto: "El equipo de logística dejó de cargar las bajas a mano y pudo ponerse al día."
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
autoria:
  yo: "Vi el problema desde adentro, porque era parte de mi trabajo en logística. Diseñé cómo tenía que funcionar el cargador y verifiqué lo que cargaba."
  ia: "Concebido, diseñado y dirigido por mí; desarrollado con IA."
  verificacion: "Comparé las bajas cargadas por el programa contra el listado de bajas del sistema."
---

## Problema

Cada baja de personal o de artículos (indumentaria y equipo) había que cargarla a mano, ítem por ítem, en los almacenes virtuales del sistema de gestión. Las bajas se acumulaban semana a semana, cada una con muchos artículos, y el equipo de logística no lograba ponerse al día. Además, la carga manual favorecía los errores.

## Qué se construyó

Diseñé un cargador que toma los datos exportados del sistema de gestión y registra las bajas por su cuenta, con mínima intervención. Se detiene y avisa si encuentra una diferencia antes de cargar. Funciona por fuera del sistema de gestión, que es de terceros, y no lo modifica.

## Resultado

Con la carga automática, el equipo de logística dejó de cargar las bajas a mano y pudo ponerse al día. En las comparaciones que hice contra el listado de bajas del sistema no encontré errores de carga. Lo hice antes de julio de 2026, antes que el cargador de facturas, que siguió el mismo enfoque.
