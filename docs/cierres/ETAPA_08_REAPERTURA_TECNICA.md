# Reapertura Tecnica Etapa 08

Fecha: 2026-03-14  
Estado: En remediacion controlada

## 1. Motivo

La auditoria tecnica detecta que `inventory` requiere reapertura formal por deuda de autorizacion:

- el modulo necesita granularidad RBAC por accion
- se requiere formalizar el rol `tenant:admin`
- el principio de menor privilegio debe reflejarse en rutas, contrato y pruebas

## 2. Alcance de remediacion

- aplicar el modelo definido en ADR-017
- alinear permisos esperados por endpoint de `inventory`
- agregar cobertura automatizada de autorizacion por accion
- mantener compatibilidad controlada con el motor RBAC existente

## 3. Dependencias documentales

- `docs/adrs/ADR-017_RBAC_GRANULARITY_INVENTORY_AND_TENANT_ADMIN.md`
- `docs/PLAN_REMEDIACION_INTEGRACION_REPO.md`

## 4. Regla de re-cierre

La Etapa 08 no vuelve a cierre formal hasta completar:

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run openapi:validate`
- contrato OpenAPI alineado para permisos esperados en `inventory`
- evidencia automatizada de autorizacion granular sin privilegio excesivo

## 5. Resultado actual

La etapa queda reabierta formalmente para remediacion controlada. No existe re-cierre narrativo en esta ola.
## 6. Re-cierre formal (2026-03-15)

Estado: Re-cierre formal completado.

Evidencia automatizada del corte:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test` -> OK
- `npm run test:coverage` -> OK
- `npm run openapi:validate` -> OK
- `npm run docs:cierres:validate` -> OK
- evidencia de autorizacion granular en rutas/tests de `inventory` y contratos RBAC de tenant

Observacion de gobernanza:

- El historial se mantiene append-only: no se elimina evidencia previa de reapertura.
- El re-cierre se documenta despues de ejecutar gates en verde del repositorio.

