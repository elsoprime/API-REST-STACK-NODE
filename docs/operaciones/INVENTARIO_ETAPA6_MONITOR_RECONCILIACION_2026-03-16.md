# Inventario Etapa 6 - Monitor de Reconciliacion y Alertas (2026-03-16)

## Objetivo

Operacionalizar la reconciliacion diaria de inventario para detectar y alertar drift entre `inventory_items.currentStock` y `inventory_balances.currentStock`.

## Alcance implementado

1. Monitor de reconciliacion programado por intervalo.
2. Barrido por tenants en `rolloutPhase` `cohort` y `general`.
3. Alertamiento por log estructurado cuando el resultado es `drift_detected`.
4. Apagado limpio del monitor durante `shutdown` de la aplicacion.

## Variables de entorno

- `INVENTORY_RECONCILIATION_MONITOR_ENABLED` (`true|false`, default `false`)
- `INVENTORY_RECONCILIATION_MONITOR_INTERVAL_MINUTES` (default `60`)
- `INVENTORY_RECONCILIATION_MONITOR_SINCE_DAYS` (default `1`)
- `INVENTORY_RECONCILIATION_MONITOR_TENANT_BATCH_SIZE` (default `100`)

## Señales operativas

- Scope OK: `inventory.reconciliation.monitor`
- Scope alerta: `inventory.reconciliation.alert`

## Procedimiento sugerido de activacion

1. Activar en entorno no productivo con `ENABLED=true`.
2. Validar al menos 2 ciclos de monitor.
3. Confirmar logs de alerta cuando se inyecta drift controlado.
4. Habilitar en productivo con batch acotado.

## DoD minimo de etapa

- Build, lint, test, coverage en verde.
- OpenAPI y enlaces de docs validados.
- Evidencia de logs en ciclo normal y ciclo con alerta.
