# EXPENSES OLA 5 - METRICAS NATIVAS - CIERRE 2026-03-22

## Objetivo

Mover el dashboard del tab `reports` desde agregacion local en frontend hacia un contrato backend dedicado y tenant-scoped, manteniendo compatibilidad con `GET /reports/summary`.

## Alcance ejecutado

### Backend

- Nuevo endpoint `GET /api/v1/modules/expenses/reports/dashboard`
- Filtros soportados: `dateWindowDays`, `status`, `categoryKey`
- Agregacion nativa para:
  - KPIs
  - tendencias por rango
  - categorias top
  - alertas operativas
  - catalogo disponible para filtros
  - `primaryCurrency` y `totalsByCurrency`
- OpenAPI actualizado con path y schemas de dashboard
- Tests de integracion dedicados para ruta, validacion y permisos
- `GET /reports/summary` se mantiene sin breaking change

### Frontend

- Nuevos tipos y mappers para dashboard nativo
- Cliente `getDashboard()` integrado a Expenses API
- `useExpensesDashboard` deja de combinar `requests` + `categories`
- `ExpensesWorkspace` consume currency principal reportada por backend
- Nota visual para escenarios multimoneda
- Smoke E2E de reports actualizado al nuevo contrato

## Validaciones ejecutadas

### Backend

- `npm run build` ?
- `npm run lint` ?
- `npm run openapi:validate` ?
- `npx vitest run tests/integration/expenses/expenses.reporting.routes.test.ts tests/integration/expenses/expenses.dashboard.routes.test.ts` ?

### Frontend

- `npm run lint` ?
- `npm run build` ?
- `npx playwright test tests/e2e/expenses-reports-dashboard.spec.ts` ?

## DoD Ola 5

- [x] Dashboard de Expenses deja de depender de agregacion local paginada
- [x] Backend expone contrato dedicado `reports/dashboard`
- [x] OpenAPI refleja el nuevo contrato
- [x] Frontend consume el endpoint nativo sin romper el tab `reports`
- [x] Mantencion de compatibilidad con `reports/summary`
- [x] Validaciones backend y frontend en verde

## Notas operativas

- Para tenants con multiples monedas, el panel usa `primaryCurrency` para KPIs visibles y conserva `totalsByCurrency` en el contrato.
- La siguiente ola recomendada permanece igual: `Ola 6 - Subcategorias Reales`.
