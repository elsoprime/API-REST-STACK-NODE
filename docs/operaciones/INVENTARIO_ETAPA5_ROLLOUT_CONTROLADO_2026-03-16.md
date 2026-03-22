# Inventario Etapa 5 - Rollout Controlado y Cierre (2026-03-16)

## Objetivo

Cerrar la etapa de escalamiento con habilitacion gradual por tenant, reconciliacion operativa diaria y evidencia de cumplimiento DoD sin alterar documentacion historica.

## Cambios aplicados en esta sprint

1. `settings` extendido con `rolloutPhase` y `capabilities` por tenant.
2. Endpoint `GET /api/v1/modules/inventory/reconciliation` para reporte operativo de drift (`items.currentStock` vs `inventory_balances.currentStock`).
3. Contratos OpenAPI actualizados para `settings` extendido y reconciliacion.

## Parametros operativos

- `rolloutPhase`:
  - `pilot`: tenant con capacidades base.
  - `cohort`: tenant en migracion controlada.
  - `general`: tenant en operacion completa.
- `capabilities`:
  - `warehouses`
  - `lots`
  - `stocktakes`

## Procedimiento recomendado de rollout por cohortes

1. Confirmar baseline del tenant (`settings`, volumen, incidentes recientes).
2. Mover `rolloutPhase` a `cohort`.
3. Habilitar capacidades una a una (`warehouses` -> `lots` -> `stocktakes`).
4. Ejecutar reconciliacion diaria (`sinceDays=1`) y revisar `status`.
5. Si `status=ok` sostenido por ventana operativa definida, mover a `general`.

## Criterios de contingencia

- Si `status=drift_detected`:
  1. Congelar nuevas mutaciones criticas del tenant.
  2. Ejecutar analisis de movimientos del periodo afectado.
  3. Aplicar ajuste correctivo con evidencia de auditoria.
  4. Repetir reconciliacion hasta estado `ok`.

## Evidencia DoD esperada por PR

- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run openapi:validate`
- `npm run docs:links:validate`

La evidencia debe adjuntar fecha/hora de ejecucion y estado en verde.
