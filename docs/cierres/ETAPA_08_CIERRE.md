# Cierre Etapa 8

Fecha: 2026-03-08  
Estado: Cierre formal aprobado

## 1. Alcance previsto

La Etapa 8 implementa `Inventory` como modulo piloto tenant-scoped para validar el core SaaS en un dominio operativo real.

Incluye:

- `categories` con create/list/update/delete (soft delete)
- `items` con create/list/get/update/delete (soft delete)
- `stock movements` con escritura transaccional y consulta historica
- `alerts` de bajo stock
- auditoria tenant-scoped en mutaciones del modulo
- aislamiento tenant por `X-Tenant-Id` + `resolveTenantContext`

## 2. Evidencia de codigo

Archivos principales:

- [inventory.types.ts](..\..\src\modules\inventory\types\inventory.types.ts)
- [inventory-category.model.ts](..\..\src\modules\inventory\models\inventory-category.model.ts)
- [inventory-item.model.ts](..\..\src\modules\inventory\models\inventory-item.model.ts)
- [inventory-stock-movement.model.ts](..\..\src\modules\inventory\models\inventory-stock-movement.model.ts)
- [inventory.schemas.ts](..\..\src\modules\inventory\schemas\inventory.schemas.ts)
- [inventory.service.ts](..\..\src\modules\inventory\services\inventory.service.ts)
- [inventory.controller.ts](..\..\src\modules\inventory\controllers\inventory.controller.ts)
- [inventory.routes.ts](..\..\src\modules\inventory\routes\inventory.routes.ts)
- [modules.routes.ts](..\..\src\modules\routes\modules.routes.ts)
- [router.ts](..\..\src\app\router.ts)
- [app.ts](..\..\src\config\app.ts)
- [error-codes.ts](..\..\src\infrastructure\errors\error-codes.ts)
- [inventory.yaml](..\..\openapi\components\schemas\inventory.yaml)
- [inventory-categories.yaml](..\..\openapi\paths\modules\inventory-categories.yaml)
- [inventory-category-by-id.yaml](..\..\openapi\paths\modules\inventory-category-by-id.yaml)
- [inventory-items.yaml](..\..\openapi\paths\modules\inventory-items.yaml)
- [inventory-item-by-id.yaml](..\..\openapi\paths\modules\inventory-item-by-id.yaml)
- [inventory-stock-movements.yaml](..\..\openapi\paths\modules\inventory-stock-movements.yaml)
- [inventory-alerts-low-stock.yaml](..\..\openapi\paths\modules\inventory-alerts-low-stock.yaml)
- [openapi.yaml](..\..\openapi\openapi.yaml)

## 3. Evidencia automatizada

Comandos verificados:

- `npm run build`
- `npm run openapi:validate`
- `npm run test`
- `npm run lint`

Cobertura funcional minima:

- reglas de servicio para conflictos y movimiento transaccional: [inventory.service.test.ts](..\..\tests\unit\modules\inventory\inventory.service.test.ts)
- contrato HTTP y guards RBAC del modulo: [inventory.routes.test.ts](..\..\tests\integration\inventory\inventory.routes.test.ts)
- consulta historica de movimientos: [inventory.stock-history.test.ts](..\..\tests\integration\inventory\inventory.stock-history.test.ts)
- aislamiento tenant ante mismatch de scope: [inventory.isolation.test.ts](..\..\tests\integration\inventory\inventory.isolation.test.ts)

## 4. Evidencia de contrato

- se publica `GET /api/v1/modules/inventory/categories`
- se publica `POST /api/v1/modules/inventory/categories`
- se publica `PATCH /api/v1/modules/inventory/categories/{categoryId}`
- se publica `DELETE /api/v1/modules/inventory/categories/{categoryId}`
- se publica `GET /api/v1/modules/inventory/items`
- se publica `POST /api/v1/modules/inventory/items`
- se publica `GET /api/v1/modules/inventory/items/{itemId}`
- se publica `PATCH /api/v1/modules/inventory/items/{itemId}`
- se publica `DELETE /api/v1/modules/inventory/items/{itemId}`
- se publica `POST /api/v1/modules/inventory/stock-movements`
- se publica `GET /api/v1/modules/inventory/stock-movements`
- se publica `GET /api/v1/modules/inventory/alerts/low-stock`
- todas las rutas requieren autenticacion valida y `X-Tenant-Id`
- mutaciones cookie-auth exponen `X-CSRF-Token` en contrato
- el acceso del modulo exige `tenant:modules:inventory:use`
- respuestas exitosas usan `buildSuccess()` o `buildPaginatedSuccess()`
- errores usan el envelope global con codigos estables (`INV_*`, `RBAC_*`, `GEN_*`)
- los movimientos de stock usan transaccion Mongo y control de concurrencia para evitar underflow y race conditions

## 5. Veredicto

La Etapa 8 queda formalmente cerrada.

## 6. Re-cierre tecnico

Fecha: 2026-03-10  
Estado: Re-cierre aplicado por hardening de tenant-context en servicio y CSRF cookie-auth.

Se incorpora al cierre de Etapa 8:

- `InventoryService` valida coherencia contractual entre `tenantId` solicitado y `context.tenant.tenantId`:
  - mismatch falla cerrado con `TENANT_SCOPE_MISMATCH` (`400`) antes de mutaciones.
  - aplica a create/update/delete de categorias e items, y a stock movements.
- Rutas de mutacion de `Inventory` amplian evidencia browser-first:
  - test negativo para cookie-auth sin header CSRF en `POST /modules/inventory/categories`.
  - test positivo para cookie-auth con header CSRF valido en el mismo endpoint.
- OpenAPI de mutaciones Inventory explicita regla condicional de `X-CSRF-Token` para auth por cookie.

Cobertura agregada:

- `tests/unit/modules/inventory/inventory.service.test.ts`
- `tests/integration/inventory/inventory.routes.test.ts`

Validaciones ejecutadas:

- `npm run docs:cierres:validate`
- `npm run openapi:validate`
- `npm run build`
- `npm run lint`
- `npm run test` (`98` archivos, `278` tests en verde, `1` skipped)

