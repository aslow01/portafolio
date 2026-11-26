---
titulo: "Automatización de la carga de facturas"
resumen: "Un cargador hecho a medida para la empresa, que concilia las facturas contra ARCA, controla cada comprobante antes de guardarlo y se detiene ante cualquier diferencia."
caminos: [tecnico, logistica]
orden: 2
estado: publicado
resultadoCorto: "En uso diario: más de 2.000 comprobantes por mes."
regla: "Se detiene ante cualquier diferencia, por mínima que sea. Nada se guarda sin aprobación humana."
uso: "Diario, más de 2.000 comprobantes por mes"
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
lineaObra: "En uso diario: más de 2.000 comprobantes por mes, en una empresa de seguridad privada de San Juan."
resultado:
  cifra: "40 → 300+"
  unidad: "facturas por jornada"
  medicion: "Promedios por jornada, octubre de 2026. Las de 300+ comparten el día con las órdenes de pago: no es un tope."
demo: lector-facturas
destacado: true
autoria:
  yo: "Analicé el problema con la gerencia y la contaduría, diseñé el flujo (conciliación, propuesta, aprobación, carga y control) y definí las reglas de control: qué se controla, cuándo frenar y qué decide siempre una persona."
  ia: "Concebido y dirigido por mí; desarrollado con IA."
  verificacion: "El programa compara cada dato cargado con el comprobante, incluido el total contra ARCA al centavo, y se detiene ante cualquier diferencia. Al terminar busca de nuevo cada factura para confirmar que quedó guardada una sola vez. Nada se carga sin aprobación humana. Los criterios de control los fui definiendo al ver los resultados. Durante las primeras semanas comparé a mano todos los comprobantes cargados contra los originales."
---

## Problema

Cuando pasé a administración, a pedido de la gerencia y de la contaduría, el área estaba muy atrasada. Las facturas de compra se cargaban a mano en el sistema de gestión (ERP), una por una: había fechas y montos mal cargados, comprobantes cargados dos veces y otros que nunca se habían cargado. Nadie podía responder con certeza qué faltaba.

## Qué se construyó

Un programa de escritorio para el equipo de administración, que trabaja junto al ERP sin modificarlo:

- **Conciliación diaria.** Cruza los comprobantes recibidos que publica ARCA con lo que ya está cargado en el ERP y muestra lo que falta, con su importe.
- **Propuesta por historial.** Para cada factura propone el gasto, el centro de costo y los impuestos según cómo se cargó siempre ese proveedor. Si el historial es parejo, la factura queda lista; si no, pasa a revisión con su nivel de confianza y la explicación de por qué se propone eso. Si el proveedor es nuevo, una persona la completa y puede dejarla como regla para las próximas.
- **IA local como segunda opinión.** Cuando la propuesta es dudosa, una IA que corre en la oficina, sin enviar datos afuera, lee el comprobante y sugiere una imputación. Solo completa el formulario: nunca aprueba ni guarda. También responde consultas del equipo sobre proveedores y cargas anteriores.
- **Carga automática en el ERP.** Carga cada factura aprobada en la pantalla del ERP, como lo haría una persona.
- **Más allá de las facturas.** Con el tiempo se sumaron otros egresos (tiques, viáticos), las órdenes de pago con control de doble pago y un registro de pagos compartido que reemplazó a la planilla de cálculo.

## Cómo se controla

El principio de diseño fue uno solo: **el programa nunca guarda algo que no coincide.** Como automatizar la pantalla de otro programa es frágil, cada sesión empieza con una carga de prueba y, ante cualquier diferencia, se detiene.

- Antes de cada factura busca en el ERP si ya existe, también a nombre de otro proveedor.
- Después de cargarla, lee la pantalla y compara cada dato, incluido el total contra ARCA, sin tolerancia. Ante cualquier diferencia se detiene y no sigue con las demás.
- Al terminar, vuelve a buscar cada factura para confirmar que quedó guardada una sola vez.
- Cada sesión empieza con una carga de prueba que se descarta, para comprobar que la pantalla está en condiciones.
- Nada se carga sin aprobación humana. Una factura puede quedar retenida con su motivo, y una lista de "no pagar" bloquea las órdenes que requieren autorización.
- Varias personas trabajan a la vez sin pisarse: cada factura en curso queda reservada a quien la está cargando, y un registro de actividad que no se borra anota quién hizo qué y cuándo.
- Una guía de uso completa y un buzón de sugerencias, con estado y respuesta, para que el equipo pida mejoras.

## Puesta al día de la facturación

Además del cargador, puse al día la facturación de compras de enero a octubre de 2026. Revisé las facturas y las órdenes de pago, una contra otra, y corregí y recargué lo que correspondía. Apliqué los criterios de imputación de la contaduría, con base en cursos cortos de contabilidad. La IA procesó los comprobantes y marcó las diferencias; yo revisé cada una. Llevó alrededor de un mes. Como control final, los totales de cada mes coinciden al centavo con los comprobantes recibidos que publica ARCA: no faltan ni sobran facturas.

## Resultado

Empecé el desarrollo en julio de 2026, antes de pasar a administración, y el programa está en uso diario desde agosto de 2026. Hoy carga más de 2.000 comprobantes por mes con sus órdenes de pago, y yo controlo el resultado. El promedio de 300 es por jornada, no un tope: el total del mes lo fija lo que llega y no todos los días son de carga. El equipo de administración lo usa todos los días, incluso cuando su autor no está.
