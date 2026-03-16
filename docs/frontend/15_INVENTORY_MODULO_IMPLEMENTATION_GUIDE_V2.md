# Guia de Implementacion Frontend - Modulo Inventario Escalable V2

Version: 1.0.0
Estado: Activo
Ultima actualizacion: 2026-03-16

## 1. Objetivo

Guiar al equipo frontend para evolucionar la implementacion actual (piloto) hacia el modulo de inventario completo y escalable ya disponible en backend.

## 2. Alcance

Esta guia cubre:

- integracion de nuevas capacidades de inventario
- contrato API esperado
- estrategia de estado/cache
- plan de rollout frontend
- DoD especifico del modulo

Fuente de verdad API: `openapi/openapi.yaml` y `openapi/paths/modules/inventory-*`.

## 3. Capacidades a implementar (ademas del piloto)

1. Bodegas (`warehouses`)
2. Lotes (`lots`) y vencimientos
3. Movimientos extendidos:
- `entry`
- `exit`
- `adjust`
- `transfer`
- `return`
4. Stocktake:
- `draft -> counting -> applied/cancelled`
5. Reconciliacion y salud operativa del modulo
6. Settings de inventario por tenant

## 4. Arquitectura frontend recomendada

## 4.1 Modulos UI

- `inventory/dashboard`
- `inventory/items`
- `inventory/warehouses`
- `inventory/lots`
- `inventory/movements`
- `inventory/stocktakes`
- `inventory/reconciliation`
- `inventory/settings`

## 4.2 API client

Usar cliente estandar de `docs/frontend/30_API_CLIENT_STANDARD.md`.

Reglas obligatorias:

- `X-Tenant-Id` en rutas tenant-scoped
- `X-CSRF-Token` en mutaciones cookie-auth
- error mapping por `error.code`

## 4.3 Estado y cache

Usar politica de `docs/frontend/40_STATE_AND_CACHE_POLICY.md`.

Query keys sugeridas:

- `['inventory', tenantId, 'items', filters]`
- `['inventory', tenantId, 'warehouses']`
- `['inventory', tenantId, 'lots', filters]`
- `['inventory', tenantId, 'movements', filters]`
- `['inventory', tenantId, 'stocktakes', filters]`
- `['inventory', tenantId, 'settings']`
- `['inventory', tenantId, 'reconciliation']`

## 5. Orden de implementacion frontend (sprints)

## Sprint A - Fundaciones

1. Ajustar tipos TS de inventario al contrato OpenAPI actual.
2. Consolidar hooks base y mapeo de errores.
3. Crear guardas por permisos de inventario.

## Sprint B - Bodegas + movimientos extendidos

1. Vistas de bodegas.
2. Formularios de `entry/exit/adjust/transfer/return`.
3. Historial de movimientos con filtros.

## Sprint C - Lotes + vencimientos

1. CRUD de lotes.
2. Vistas de alertas de vencimiento.
3. Integracion de politicas de salida (FIFO/FEFO en UX si aplica por backend).

## Sprint D - Stocktake

1. Flujo completo de conteo.
2. Aplicacion/cancelacion de stocktake.
3. Evidencia en timeline/historial.

## Sprint E - Reconciliacion + operacion

1. Vista de reconciliacion por tenant.
2. Superficie operativa con datos de `/health` para soporte interno.
3. Mensajeria UX para estados degradados.

## 6. UX minima obligatoria por flujo

- Errores de conflicto de stock: mensaje accionable + refetch automatico controlado.
- Underflow: bloquear confirmacion y sugerir correccion.
- Transferencias: validar origen/destino distintos y cantidad > 0.
- Stocktake: confirmar transiciones irreversibles (`apply/cancel`).

## 7. Permisos y seguridad

- No renderizar acciones de mutacion sin permiso.
- Nunca cachear datos de tenant A en contexto de tenant B.
- Limpiar cache de inventario en `tenant switch`.

## 8. Testing obligatorio frontend

## Unit/Component

- formularios de movimientos
- validaciones de lotes/stocktake
- mapeo de errores por `error.code`

## Integration (MSW)

- alta/baja de movimientos
- conflictos de stock y rollback UX
- stocktake apply/cancel

## E2E critico

1. Item + stock inicial
2. Transferencia entre bodegas
3. Lote proximo a vencer visible en alertas
4. Stocktake aplicado y stock actualizado
5. Reconciliacion visible sin errores

## 9. DoD frontend del modulo inventario

- [ ] Sin endpoints fuera de OpenAPI
- [ ] Sin mutaciones sin CSRF cuando corresponde
- [ ] Sin fugas cross-tenant en cache
- [ ] Errores criticos mapeados y probados
- [ ] E2E critico en verde
- [ ] Documentacion actualizada en `docs/frontend/*`

## 10. Sincronizacion con repositorio frontend

Objetivo posterior:

- Replicar esta guia en `FRONTEND-STACK-NEXT-TAILWIND/docs/*`
- Mantener mismo versionado y fecha de corte
- Validar enlaces cruzados y rutas reales del frontend repo
