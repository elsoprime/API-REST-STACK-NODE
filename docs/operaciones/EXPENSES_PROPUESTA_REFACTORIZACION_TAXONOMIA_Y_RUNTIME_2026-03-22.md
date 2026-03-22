# EXPENSES PROPUESTA DE REFACTORIZACION DE TAXONOMIA Y RUNTIME 2026-03-22

## Proposito

Dejar una propuesta ejecutable para evolucionar `Expenses` hacia un modelo SaaS mas solido, con taxonomia real de categorias/subcategorias, flujo de requests consistente en runtime y una secuencia de olas que reduzca deuda tecnica en lugar de desplazarla.

Este documento no reemplaza el checklist maestro.
Este documento complementa la planificacion futura de `Expenses`.

## Diagnostico Actual

### 1. Brecha de runtime en create-request

Estado actual:
- el frontend usa `input type="date"` y envia `expenseDate` en formato `YYYY-MM-DD`
- el backend valida `expenseDate` como `datetime` ISO con offset
- conclusion: la creacion de solicitudes desde UI puede fallar con `400` aunque el flujo este visualmente montado

Impacto:
- el modulo no debe considerarse completamente cerrado para uso operativo de requests mientras esta brecha siga abierta

### 2. Taxonomia incompleta

Estado actual:
- `ExpenseCategory` existe como entidad real
- la subcategoria no existe como entidad backend
- en frontend solo existe una convencion draft basada en `key`
- hoy `travel_local` se interpreta como una categoria plana, no como hija real de `travel`

Impacto:
- metricas menos precisas
- reglas mas dificiles de mantener
- exportes y auditoria menos estructurados
- deuda tecnica si se sigue ampliando el modulo sobre `categoryKey` como unica fuente

### 3. Requests acoplados a key textual

Estado actual:
- el request depende de `categoryKey`
- no existe `categoryId` ni `subcategoryId` como referencias estructuradas

Impacto:
- menor integridad referencial
- gobernanza fragil del catalogo
- cambios de nombre/key mas costosos

## Objetivo Tecnico

Evolucionar `Expenses` a este modelo objetivo:

### ExpenseCategory
- `id`
- `tenantId`
- `key`
- `name`
- `requiresAttachment`
- `monthlyLimit`
- `isActive`

### ExpenseSubcategory
- `id`
- `tenantId`
- `categoryId`
- `key`
- `normalizedKey`
- `name`
- `requiresAttachment`
- `monthlyLimit`
- `isActive`

### ExpenseRequest
- `categoryId`
- `categoryKey`
- `categoryName`
- `subcategoryId`
- `subcategoryKey`
- `subcategoryName`
- `amount`
- `currency`
- `expenseDate`
- workflow actual

## Principios de Implementacion

- no usar subcategoria como string libre en el request
- no romper `reports/summary` ni `reports/dashboard`
- mantener compatibilidad transitoria con lectura legada
- separar runtime hotfix de refactor estructural cuando el riesgo lo requiera
- una ola funcional = un objetivo principal por repo
- cada ola debe cerrar con documento espejo backend/frontend

## Mejor Camino Recomendado

### Fase 0 - Alineacion documental y criterio de cambio

Objetivo:
- fijar modelo objetivo antes de tocar runtime o catalogo

Salida esperada:
- propuesta validada
- checklist maestro actualizado

### Fase 1 - Hotfix de runtime create-request

Objetivo:
- restaurar confiabilidad basica de creacion/edicion de requests

Recomendacion tecnica:
- preferir correccion en frontend transformando `YYYY-MM-DD` a ISO valido antes de enviar
- alternativa secundaria: flexibilizar backend para aceptar `date-only`

DoD:
- crear solicitud desde UI en `main` funciona en runtime
- editar solicitud mantiene contrato consistente
- smoke focal de create/update queda verde

### Fase 2 - Subcategorias reales como catalogo formal

Objetivo:
- introducir `ExpenseSubcategory` como entidad tenant-scoped real

Backend:
- modelo de subcategoria
- CRUD/listado tenant-scoped
- validacion de unicidad por `tenantId + categoryId + normalizedKey`
- OpenAPI y tests de integracion

Frontend:
- gestion de subcategorias en settings/catalogo
- UI padre/hijo real
- sin tocar aun request form si se quiere aislar el riesgo

DoD:
- subcategorias persistidas y consultables
- relacion real categoria -> subcategoria
- gobernanza sin depender de `parent_sub`

### Fase 3 - Requests taxonomicos

Objetivo:
- hacer que el request use referencias estructuradas reales

Backend:
- create/update con `categoryId` y `subcategoryId`
- validacion de pertenencia `subcategory.categoryId === categoryId`
- mantener snapshots (`categoryKey/name`, `subcategoryKey/name`)
- compatibilidad temporal con lectura legada

Frontend:
- request form con selector categoria -> subcategoria dependiente
- reglas claras cuando una categoria no tiene subcategorias

DoD:
- nueva solicitud guarda taxonomia estructurada
- request deja de depender solo de `categoryKey`
- reportes siguen estables

### Fase 4 - Politicas y metricas por subcategoria

Objetivo:
- aprovechar la taxonomia real para control operativo

Capacidades:
- limites por subcategoria
- adjuntos por subcategoria
- dashboards por subcategoria
- reglas de aprobacion mas finas por segmento

DoD:
- metricas y politicas consumen taxonomia real
- dashboard reporta categoria/subcategoria sin derivacion por string

### Fase 5 - Backfill y cleanup

Objetivo:
- cerrar deuda residual de compatibilidad

Capacidades:
- script de migracion para requests historicos cuando exista mapeo seguro
- deprecacion controlada del write-path basado solo en `categoryKey`
- limpieza de la convencion legacy `parent_sub`

DoD:
- modelo final coherente
- compatibilidad residual documentada o eliminada

## Estrategia de Compatibilidad

Durante la transicion se recomienda:
- mantener `categoryKey/categoryName` y `subcategoryKey/subcategoryName` como snapshot del request
- usar `categoryId/subcategoryId` como fuente primaria de integridad
- no hacer migraciones agresivas sin tabla de equivalencias confirmada

## Riesgos si no se refactoriza

- crecimiento de catalogo sobre strings ambiguos
- mayor costo de reportes y gobernanza
- reglas de aprobacion o politicas cada vez mas acopladas a `key`
- mas probabilidad de inconsistencia historica

## Orden recomendado de ejecucion

1. Hotfix runtime `create-request`
2. Subcategorias reales
3. Requests taxonomicos
4. Politicas y metricas por subcategoria
5. Backfill y cleanup

## Decision tecnica recomendada

- si el objetivo es un modulo `Expenses` SaaS serio, la combinacion `categoria + subcategoria` es valida y recomendable
- la mejor implementacion no es por convencion textual, sino por relacion real de catalogo
- la deuda tecnica se minimiza si el request migra a referencias estructuradas y snapshots historicos
