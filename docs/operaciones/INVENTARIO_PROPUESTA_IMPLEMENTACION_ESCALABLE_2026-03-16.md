# Propuesta de Implementacion Escalable - Modulo de Inventario (2026-03-16)

## 1) Diagnostico Ejecutivo

Estado base confirmado en `API-REST-STACK-NODE`:

- Piloto funcional existente: items, categorias, movimientos, alertas low-stock, RBAC y auditoria tenant-scoped.
- Extensiones ya integradas en esta ejecucion: `warehouses`, `inventory_balances`, motor de movimientos extendidos (`entry|exit|adjust|transfer|return`) e idempotencia por `idempotencyKey`.

Conclusion tecnica: **si es factible escalar el modulo** sin ruptura de contratos v1, siempre que se respete rollout progresivo por fases, controles transaccionales e invariantes de stock.

## 2) Respuestas Directas Solicitadas

### 2.1 Es posible escalar el modulo?

Si. La base actual y la propuesta `inventario-escalamiento-v2` son compatibles con una evolucion incremental. El diseno transaccional y multi-tenant ya existe y permite crecimiento por capacidades.

### 2.2 Cuales son los pro y contras?

Pros:

- Escalabilidad funcional por fases sin big-bang.
- Mayor trazabilidad operacional (ledger extendido + idempotencia).
- Reduccion de riesgo de doble aplicacion en mutaciones de stock.
- Preparacion para lotes, stocktakes y reporteria avanzada.
- Compatibilidad hacia atras con rutas v1 existentes.

Contras:

- Mayor complejidad de dominio (mas entidades, mas invariantes de negocio).
- Incremento en costo de testing (concurrencia, aislamiento tenant, regresion).
- Requiere disciplina operativa: feature flags, migraciones seguras y observabilidad.
- Curva de adopcion para equipos (nuevos permisos, nuevos flujos).

### 2.3 Se puede documentar sin alterar ruido en documentacion existente?

Si. La estrategia recomendada es **aditiva**:

- Agregar nuevos documentos en `docs/operaciones/`.
- No modificar artefactos historicos ni documentos canonicos existentes.
- Mantener validacion automatica con `docs:links:validate`.

### 2.4 Se puede complementar la documentacion sin alteracion de documentos actuales?

Si. Se complementa mediante nuevos anexos operativos y guias por etapa, manteniendo trazabilidad a OpenAPI/ADR sin editar documentos previos.

## 3) Mejoras Sustanciales Recomendadas

1. Formalizar invariantes de stock como contrato explicito:
   - no saldo negativo salvo politica permitida;
   - trazabilidad completa por `tenantId`, `itemId`, `movementType`, `idempotencyKey`.
2. Implementar feature flags por capacidad (`warehouses`, `lots`, `stocktakes`) para rollout por tenant.
3. Definir SLOs y alertas por endpoint critico (p95, errores 5xx, conflictos de concurrencia).
4. Agregar reconciliacion automatizada diaria (ledger vs balance) con reporte de desvio.
5. Extender suite de pruebas de concurrencia para transferencias simultaneas y reintentos idempotentes.

## 4) Plan de Implementacion Paso a Paso (Guia Ejecutable)

## Etapa 0 - Baseline y seguridad de despliegue

Objetivo: establecer guardrails tecnicos y de operacion.

Pasos:

1. Definir metricas objetivo (p95, error rate, throughput por tenant).
2. Activar feature flags por modulo incremental.
3. Validar runbook de rollback por capacidad.
4. Confirmar gates CI/CD: `build`, `lint`, `test`, `openapi:validate`, `docs:links:validate`.

DoD Etapa 0:

- Dashboards y alertas activas.
- Flags creadas y documentadas.
- Rollback probado en entorno no productivo.

## Etapa 1 - Multi-bodega y balance por ubicacion

Objetivo: introducir modelo fisico de almacenamiento.

Pasos:

1. Crear/activar `inventory_warehouses`.
2. Crear/activar `inventory_balances`.
3. Exponer CRUD de bodegas.
4. Endurecer indices por tenant y claves de negocio.
5. Ejecutar pruebas de aislamiento tenant + permisos.

DoD Etapa 1:

- CRUD bodegas operativo.
- Integridad de balances por bodega validada.
- Pruebas de autorizacion y aislamiento en verde.

## Etapa 2 - Motor transaccional extendido

Objetivo: unificar mutaciones de stock bajo comandos tipados.

Pasos:

1. Implementar `entry|exit|adjust|transfer|return`.
2. Incorporar `idempotencyKey` por mutacion.
3. Aplicar transacciones atomicas y manejo de conflictos.
4. Publicar contratos OpenAPI por endpoint.
5. Probar concurrencia en `transfer` y `exit`.

DoD Etapa 2:

- No duplicidad de mutaciones idempotentes.
- Sin drift entre ledger y balances en pruebas de estres.
- Contratos OpenAPI validados.

## Etapa 3 - Lotes, vencimientos y politicas de salida

Objetivo: control de caducidad y trazabilidad por lote.

Pasos:

1. Implementar `inventory_lots` y alertas de vencimiento.
2. Configurar FEFO/FIFO por tenant.
3. Ajustar movimientos de salida para consumir lotes segun politica.
4. Publicar reporte kardex y valorizacion base.

DoD Etapa 3:

- FEFO/FIFO verificable en pruebas funcionales.
- Alertas de vencimiento funcionando por ventana configurable.
- Kardex consistente con movimientos.

## Etapa 4 - Stocktakes y ajustes masivos

Objetivo: habilitar conteo fisico auditable.

Pasos:

1. Implementar ciclo de `stocktakes` (draft -> counting -> applied/cancelled).
2. Persistir conteos y diferencias por item/lote/bodega.
3. Aplicar ajustes masivos transaccionalmente.
4. Generar evidencia audit trail por operacion.

DoD Etapa 4:

- Flujo completo de stocktake en E2E.
- Aplicacion de ajustes sin corrupcion de stock.
- Auditoria completa por actor/tenant/fecha.

## Etapa 5 - Rollout controlado y cierre

Objetivo: migrar tenants sin interrupcion.

Pasos:

1. Habilitar por cohortes de tenants.
2. Monitorear y reconciliar diariamente.
3. Ejecutar plan de contingencia ante desviaciones.
4. Cerrar etapa con evidencia tecnica y operativa.

DoD Etapa 5:

- Cohortes migradas sin regresiones criticas.
- Reconciliacion diaria sin desvio material.
- Documentacion y evidencia de cierre aprobadas.

## 5) Estrategia Documental sin Ruido

Principio: **solo adiciones**.

Acciones:

1. Crear guias nuevas en `docs/operaciones/` (sin modificar documentos activos existentes).
2. Mantener contratos API en `openapi/` como fuente de verdad.
3. Registrar decisiones estructurales en ADR nuevo solo si hay cambio arquitectonico neto.
4. Ejecutar `npm run docs:links:validate` en cada PR documental.

## 6) Validaciones DoD Obligatorias por PR

Ejecutar y dejar evidencia:

```bash
npm run build
npm run lint
npm run test
npm run test:coverage
npm run openapi:validate
npm run docs:links:validate
```

Criterio de avance: **no pasar a la siguiente etapa sin todos los gates en verde**.

## 7) Riesgos Principales y Mitigacion

1. Condiciones de carrera en movimientos concurrentes.
   - Mitigacion: transacciones + indices + pruebas de estres.
2. Divergencia ledger/balance.
   - Mitigacion: reconciliacion automatizada y alarmas.
3. Sobrecrecimiento de contratos API.
   - Mitigacion: versionado conservador y compatibilidad v1.
4. Ruido documental.
   - Mitigacion: politica aditiva + control de enlaces.

## 8) Resultado Esperado

Modulo de inventario escalado desde piloto a operacion multi-bodega, con trazabilidad robusta, compatibilidad v1, rollout controlado y documentacion complementaria no intrusiva.
