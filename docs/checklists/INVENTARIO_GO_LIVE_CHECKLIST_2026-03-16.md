# Checklist Go-Live Inventario (2026-03-16)

## A. Pre-deploy

- [ ] Variables inventario cargadas y auditadas:
  - [ ] `INVENTORY_RECONCILIATION_MONITOR_ENABLED`
  - [ ] `INVENTORY_RECONCILIATION_MONITOR_INTERVAL_MINUTES`
  - [ ] `INVENTORY_RECONCILIATION_MONITOR_SINCE_DAYS`
  - [ ] `INVENTORY_RECONCILIATION_MONITOR_TENANT_BATCH_SIZE`
  - [ ] `INVENTORY_RECONCILIATION_ALERT_DRIFT_CONSECUTIVE_THRESHOLD`
  - [ ] `INVENTORY_RECONCILIATION_ALERT_FAILURE_CONSECUTIVE_THRESHOLD`
  - [ ] `INVENTORY_RECONCILIATION_ALERT_SKIPPED_TICKS_THRESHOLD`
- [ ] Gates CI locales/pipeline en verde.
- [ ] OpenAPI validado.
- [ ] Documentacion de operacion y frontend actualizada.

## B. Deploy

- [ ] Desplegar release en canary/cohorte inicial.
- [ ] Verificar logs de startup sin errores de bootstrap.
- [ ] Verificar `GET /health`:
  - [ ] `ready=true`
  - [ ] `inventoryReconciliationMonitor.enabled=true` (si aplica)
  - [ ] `inventoryReconciliationMonitor.status` estable (`idle/running`)

## C. Post-deploy (0-2h)

- [ ] Confirmar al menos 2 ciclos de monitor.
- [ ] Revisar `alerts`:
  - [ ] `driftConsecutiveBreached=false`
  - [ ] `failedConsecutiveBreached=false`
  - [ ] `skippedTicksBreached=false`
- [ ] Revisar rutas criticas inventario desde UI.

## D. Escalado de cohortes

- [ ] Cohorte 1 estable.
- [ ] Incrementar cohortes de forma gradual.
- [ ] Registrar evidencia en bitacora operativa.

## E. Criterios de rollback

- [ ] `failedConsecutiveBreached=true` sostenido.
- [ ] `driftConsecutiveBreached=true` sostenido en tenants criticos.
- [ ] errores 5xx repetidos en rutas de inventario.

Accion inmediata:

1. Desactivar monitor o reducir carga por flags.
2. Volver a cohorte previa estable.
3. Ejecutar triage y documentar RCA.

## F. Estado actual de esta ola (2026-03-17)

- Estado de avance: **Cerrado en desarrollo / Ready for Integration Validation**.
- Go-live operativo: **Pospuesto**.
- Esta checklist permanece como prerequisito pendiente para la siguiente ventana de release real.
