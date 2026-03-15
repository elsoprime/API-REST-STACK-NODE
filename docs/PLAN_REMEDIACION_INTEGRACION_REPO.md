# Plan de Remediacion - Integracion REPO

Fecha: 2026-03-14  
Estado: Activo (Olas 2A/2B/2C/2D completadas, Ola 3 en ejecucion)  
Ultima actualizacion: 2026-03-15  
Fuente externa de entrada: `H:/FullStack-Projects/Informe_Auditoria_Integracion_REPO.md`

## 1. Objetivo

Alinear la implementacion de `API-REST-STACK-NODE` con el canon documental y tecnico del repositorio, sin introducir deriva documental ni cierres narrativos.

## 2. Regla de relacion con el canon

Este documento no reemplaza a la fuente de verdad.

Orden de precedencia:

1. `docs/PLAN_MAESTRO.md`
2. `docs/arquitectura/*`
3. `docs/adrs/*`
4. `docs/anexos/*`

Este plan solo ordena la remediacion, define olas y enlaza el trabajo con los documentos canonicos correspondientes.

## 3. Alcance

Incluye:

- lifecycle tenant/suscripcion y gating por pago
- seguridad de webhooks de billing
- granularidad RBAC en `inventory`
- hardening operativo minimo para go-live
- trazabilidad documental y re-cierres formales por etapa

No incluye en este corte:

- reescritura completa de CRM/HR
- rediseno UX frontend
- metering/quotas como linea de producto separada

## 4. Olas de ejecucion

### Ola 1 - Gobernanza documental y baseline tecnico

Objetivo: fijar decisiones, reaperturas y trazabilidad antes de cambios de contrato o runtime.

Incluye:

- aprobar y normalizar ADR-015, ADR-016 y ADR-017
- reabrir formalmente etapas 03, 08 y 11
- alinear este plan con el canon del repositorio
- congelar baseline tecnico verificable para remediacion posterior

Salida esperada:

- decisiones estructurales aprobadas
- etapas reabiertas con criterio de re-cierre explicito
- backlog de remediacion ordenado por riesgo

### Ola 2 - Implementacion, contratos y evidencia automatizada

Objetivo: ejecutar los cambios runtime necesarios y actualizar el canon minimo correspondiente.

Sub-olas:

- 2A - CI y coverage ejecutable: completada
- 2B - hardening runtime: completada
- 2C - webhook contract: completada
- 2D - coverage hotspots: completada

Incluye:

- tenant/suscripcion segun ADR-015
- webhooks y anti-replay segun ADR-016
- RBAC granular `inventory` y `tenant:admin` segun ADR-017
- CI reproducible y coverage ejecutable
- cambios OpenAPI y contratos transversales cuando aplique

Salida esperada:

- codigo, OpenAPI y documentos canonicos alineados
- evidencia automatizada verde para los cambios ejecutados
- backlog de coverage ordenado por criticidad tecnica y de negocio

### Ola 3 - Consolidacion para developers, operaciones y re-cierre formal

Objetivo: reflejar la verdad actual en documentacion derivada y cerrar formalmente las etapas reabiertas.

Incluye:

- actualizar README y runbooks afectados
- actualizar documentacion derivada de integracion cuando cambie contrato
- publicar evidencia de gates y suites relevantes
- re-cerrar etapas 03, 08 y 11 con evidencia ejecutable

Salida esperada:

- documentacion consistente para developers y operaciones
- historial append-only sin contradicciones
- etapas re-cerradas formalmente

## 5. Mapa de trabajo por etapa

| Etapa | Tema principal | Decision canonica | Estado actual |
|---|---|---|---|
| 03 | Lifecycle tenant/suscripcion | `ADR-015` | Re-cierre formal completado (2026-03-15) |
| 08 | RBAC granular inventory | `ADR-017` | Re-cierre formal completado (2026-03-15) |
| 11 | Hardening operativo y webhook security | `ADR-016` | Re-cierre formal completado (2026-03-15) |

## 6. Baseline tecnico esperado para avanzar de ola

Antes de ejecutar re-cierres de Ola 2 debe existir baseline verificable con:

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:coverage`
- `npm run openapi:validate`
- `npm run docs:cierres:validate`

## 7. Criterios de exito

- no existe activacion de tenant/suscripcion fuera del flujo canonico definido
- los webhooks criticos son resistentes a replay y duplicados segun el contrato aprobado
- `inventory` deja de depender de permisos excesivos para operaciones destructivas
- la documentacion canonica y derivada cuentan una sola historia consistente
- ningun re-cierre ocurre sin evidencia automatizada en verde

## 8. Matriz Ola 2D - baseline de coverage por modulo

Fuente: `npm run test:coverage` + `coverage/coverage-summary.json`

| Prioridad | Modulo / archivo | Statements | Branches | Functions | Motivo de priorizacion |
|---|---|---:|---:|---:|---|
| Alta | `src/modules/crm/services/crm.service.ts` | 19.93% | 54.54% | 30.95% | modulo grande con deuda alta y alto riesgo de regresion funcional |
| Alta | `src/core/platform/billing/services/billing.service.ts` | 33.66% | 61.22% | 51.85% | seguridad y lifecycle de suscripcion dependen de esta capa |
| Alta | `src/modules/inventory/services/inventory.service.ts` | 30.22% | 62.50% | 44.00% | operaciones destructivas y consistencia de stock |
| Alta | `src/modules/hr/services/hr.service.ts` | 36.10% | 50.64% | 60.86% | dominio sensible por PII, compensacion y ausencias |
| Media | `src/core/tenant/services/tenant.service.ts` | 55.30% | 54.05% | 85.71% | tenant lifecycle y aislamiento merecen mas casos de borde |
| Media | `src/infrastructure/redis/redis.client.ts` | 17.54% | 100.00% | 20.00% | ruta operativa critica para despliegue multi-instancia y rate limit distribuido |

## 9. Orden recomendado para atacar coverage hotspots

1. `billing.service.ts`
2. `inventory.service.ts`
3. `hr.service.ts`
4. `crm.service.ts`
5. `tenant.service.ts`
6. `redis.client.ts`

## 10. Evidencia minima para cerrar Ola 2D

- tests nuevos por rama critica y no solo happy path
- coverage por archivo mejorado sobre la linea base registrada en este documento
- sin degradacion del gate global de coverage definido en CI
- evidencia reproducible en `npm run test:coverage`
## 11. Estado ejecutado y transicion a Ola 3 (2026-03-15)

Evidencia automatizada ejecutada en verde para cierre de Ola 2D y habilitacion de Ola 3:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test` -> OK
- `npm run test:coverage` -> OK (gate global en verde)
- `npm run openapi:validate` -> OK
- `npm run docs:cierres:validate` -> OK

Resultado de hotspots priorizados en Ola 2D (medidos con `coverage/coverage-summary.json`):

- `src/modules/crm/services/crm.service.ts`: mejora sobre baseline (statements 19.93% -> 23.5%)
- `src/core/tenant/services/tenant.service.ts`: mejora sobre baseline (statements 55.30% -> 71.44%)
- `src/infrastructure/redis/redis.client.ts`: mejora sobre baseline (statements 17.54% -> 80.7%)
- `src/modules/hr/services/hr.service.ts`: mejora sobre baseline (statements 36.10% -> 37.7%)

Con esta evidencia, Ola 2D queda completada y se habilita la consolidacion documental/operativa de Ola 3.

