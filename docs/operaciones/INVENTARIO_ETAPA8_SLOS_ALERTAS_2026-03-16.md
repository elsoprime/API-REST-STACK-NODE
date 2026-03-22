# Inventario Etapa 8 - SLOs y Alertamiento Accionable (2026-03-16)

## Objetivo

Cerrar operativamente el modulo con umbrales accionables para detectar degradacion sostenida del monitor de reconciliacion y habilitar respuesta temprana.

## Alcance implementado

1. Umbrales SLO configurables por entorno:
- `INVENTORY_RECONCILIATION_ALERT_DRIFT_CONSECUTIVE_THRESHOLD`
- `INVENTORY_RECONCILIATION_ALERT_FAILURE_CONSECUTIVE_THRESHOLD`
- `INVENTORY_RECONCILIATION_ALERT_SKIPPED_TICKS_THRESHOLD`

2. Estado enriquecido del monitor (`/health`):
- `consecutiveDriftRuns`
- `consecutiveFailedRuns`
- `thresholds`
- `alerts` (`driftConsecutiveBreached`, `failedConsecutiveBreached`, `skippedTicksBreached`)

3. Alertamiento accionable en logs (`scope=inventory.reconciliation.slo`):
- breach por drift consecutivo
- breach por fallas consecutivas
- breach por `skippedTicks`
- logs de recuperacion cuando drift/fallas vuelven bajo umbral

## Semantica operativa

- `driftConsecutiveBreached=true`: el inventario muestra desvio en corridas consecutivas por encima del umbral.
- `failedConsecutiveBreached=true`: la conciliacion falla de forma sostenida y requiere triage inmediato.
- `skippedTicksBreached=true`: hay evidencia de saturacion o duracion excesiva de corridas.

## Runbook minimo de respuesta

1. Verificar `GET /health` y revisar `inventoryReconciliationMonitor.alerts`.
2. Si `failedConsecutiveBreached=true`, priorizar causa de infraestructura (DB/conectividad/timeouts).
3. Si `driftConsecutiveBreached=true`, ejecutar reconciliacion manual por tenant afectado y validar stock source-of-truth.
4. Si `skippedTicksBreached=true`, aumentar `INTERVAL_MINUTES` o reducir `TENANT_BATCH_SIZE`.
5. Confirmar recuperacion: flags de breach en `false` para drift/fallas en corridas siguientes.

## DoD de etapa

- Build, lint, tests, coverage en verde.
- OpenAPI y docs links en verde.
- Evidencia de campos SLO en `/health`.
- Evidencia de pruebas unitarias para breach/recovery de umbrales.
