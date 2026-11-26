---
titulo: "Tableros de gestión para la gerencia, con números que cierran"
resumen: "Tableros de facturación, cobranzas y mora para la gerencia, en los que cada desglose cierra con el total."
caminos: [tecnico]
orden: 5
estado: publicado
contexto: "Empresa de seguridad privada de San Juan"
rol: "Diseño, dirección y verificación"
autoria:
  yo: "Definí qué necesitaba ver la gerencia y verifiqué los números."
  ia: "Concebido, diseñado y dirigido por mí; desarrollado con IA."
  verificacion: "Las pruebas automáticas y un recorrido automático de las 25 páginas controlan que todo desglose cierre con el total; yo reviso los números antes de cada entrega."
---

## Problema

La gerencia necesitaba ver facturación, cobranzas y mora sin tener que abrir ni ordenar los archivos que exporta el sistema de gestión.

## Qué se construyó

- Un visor que toma los archivos que exporta el sistema de gestión, reconoce de qué tipo es cada uno y los limpia con reglas que se pueden auditar.
- 25 páginas de tableros de facturación, cobranzas y mora, para ver los números sin abrir esos archivos.
- Un asistente con IA que solo redacta sobre números ya calculados: no calcula nada.
- Tecnologías: Python, pandas y Streamlit.

## Reglas de honestidad

Estas reglas permiten que la gerencia confíe en lo que ve:

- Todo desglose cierra con el total: "Otros" es el residuo, no un número estimado.
- La mora se mide contra una fecha de corte.
- Cada archivo que genera el visor lleva un sello que permite reproducirlo.
- A la IA no se le envían datos individuales.

## Estado y resultado

En uso por la gerencia desde el segundo semestre de 2026. La gerencia ya no depende de pedir ni ordenar los archivos exportados.
