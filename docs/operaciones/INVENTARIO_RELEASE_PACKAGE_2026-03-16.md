# Inventario - Paquete Final de Release (2026-03-16)

## 1) Changelog tecnico consolidado

### 1.1 Cambios funcionales

- Escalamiento del modulo de inventario desde piloto a capacidades avanzadas:
  - movimientos extendidos (`entry|exit|adjust|transfer|return`)
  - entidades para `warehouses`, `balances`, `lots`, `stocktakes`, `settings`
  - reconciliacion operativa de inventario
- Contratos API extendidos y validados en OpenAPI para las capacidades anteriores.
- Pruebas unitarias/integracion ampliadas para flujos de inventario y aislamiento tenant.

### 1.2 Cambios operativos

- Etapa 6: monitor de reconciliacion con alertas de drift.
- Etapa 7: observabilidad del monitor en `GET /health`.
- Etapa 8: SLOs y alertamiento accionable con umbrales por entorno:
  - drift consecutivo
  - fallas consecutivas
  - ticks omitidos (`skippedTicks`)

### 1.3 Compatibilidad

- Estrategia de evolucion aditiva, preservando comportamiento base del piloto.
- Documentacion agregada sin sobrescribir documentos historicos.

## 2) Checklist go-live (resumen ejecutivo)

Checklist detallado: `docs/checklists/INVENTARIO_GO_LIVE_CHECKLIST_2026-03-16.md`.

Puntos criticos de salida:

1. Variables de entorno de monitor y alertas cargadas.
2. `GET /health` con `inventoryReconciliationMonitor` visible y sin alertas sostenidas.
3. Gates DoD en verde:
   - `npm run build`
   - `npm run lint`
   - `npm run test`
   - `npm run test:coverage`
   - `npm run openapi:validate`
   - `npm run docs:links:validate`

## 3) Orden sugerido de flags por ambiente

## Dev

1. `INVENTORY_RECONCILIATION_MONITOR_ENABLED=true`
2. `INVENTORY_RECONCILIATION_MONITOR_INTERVAL_MINUTES=15`
3. Umbrales iniciales:
   - `INVENTORY_RECONCILIATION_ALERT_DRIFT_CONSECUTIVE_THRESHOLD=2`
   - `INVENTORY_RECONCILIATION_ALERT_FAILURE_CONSECUTIVE_THRESHOLD=2`
   - `INVENTORY_RECONCILIATION_ALERT_SKIPPED_TICKS_THRESHOLD=2`
4. Validar 2-3 ciclos en `/health` y logs.

## Staging

1. Mantener monitor activo y subir `TENANT_BATCH_SIZE` progresivamente.
2. Ajustar intervalo para carga real (ej. `30-60` min).
3. Umbrales sugeridos:
   - drift=3
   - failure=2
   - skippedTicks=3
4. Ejecutar smoke + pruebas de reconciliacion controlada.

## Produccion

1. Activar en cohorte acotada.
2. Intervalo inicial conservador (`60` min) y batch pequeno.
3. Monitorear `alerts` en `/health` por 24-48h.
4. Expandir cohortes gradualmente.
5. Si hay breach sostenido, aplicar runbook (triage + ajuste de batch/interval + rollback de flags).

## 4) Riesgos y mitigacion rapida

- Drift sostenido:
  - ejecutar reconciliacion manual por tenant afectado
  - revisar mutaciones recientes de stock
- Fallas sostenidas del monitor:
  - revisar conectividad/DB/timeouts
  - degradar batch temporalmente
- skippedTicks sostenido:
  - subir intervalo
  - bajar batch size

## 5) Evidencia de cierre del modulo

- Etapas completadas: 5, 6, 7 y 8.
- DoD validado en verde en el ultimo corte tecnico.
- Documentacion operativa y frontend complementada de forma aditiva.

## 6) Estado operativo actual (actualizacion 2026-03-17)

- Estado oficial para esta ola: **Cerrado en desarrollo / Ready for Integration Validation**.
- Go-live real (staging canary + produccion) queda **pospuesto** hasta nueva ventana operativa.
- Esta decision no invalida el cierre tecnico del modulo; solo posterga la activacion operativa por ambiente.
- Prerrequisito para pasar a go-live: completar `docs/checklists/INVENTARIO_GO_LIVE_CHECKLIST_2026-03-16.md` con evidencia real por entorno.
