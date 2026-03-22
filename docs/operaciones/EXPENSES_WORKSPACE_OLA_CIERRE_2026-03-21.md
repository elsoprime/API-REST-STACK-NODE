# Expenses Workspace - Cierre de Ola (2026-03-21)

## Objetivo de la ola

Consolidar el acceso a `expenses` con control real por plan y reforzar el workspace operativo sin introducir deuda documental.

## Alcance implementado

1. Backend: enforcement explicito por modulo en rutas de expenses.
2. Backend: pruebas de integracion para plan gating (`403 RBAC_MODULE_DENIED` cuando el modulo no esta activo).
3. Frontend: sidebar con entrada `Expenses` habilitada solo cuando plan + permisos lo permiten.
4. Frontend: workspace operativo reforzado para `requests` con KPIs, quick actions y filtros persistentes en cola.
5. Frontend: e2e dedicado para validar sidebar gating por plan.

## Cambios tecnicos relevantes

- Backend
  - `src/modules/expenses/routes/expenses.routes.ts`
    - Se agrego `requireModule('expenses')` en la cadena de middlewares.
  - `tests/integration/expenses/expenses.plan-gating.routes.test.ts`
    - Nuevo spec para escenario deny/allow por modulo activo.

- Frontend (mirror)
  - `src/components/tenant/tenant-sidebar.tsx`
    - Item `Expenses` visible con estado disabled cuando el plan no lo incluye.
    - Razon de bloqueo en `title`: `No incluido en tu plan activo` / permiso.
  - `src/modules/expenses/state/expenses.store.ts`
    - Estado persistente de filtros (`status`, `search`) para cola.
  - `src/modules/expenses/pages/ExpensesQueuePage.tsx`
    - Filtro por estado, busqueda y reset; query con `status/search`.
  - `src/modules/expenses/pages/ExpensesWorkspacePage.tsx`
    - Nueva superficie de workspace con KPIs y quick actions.
  - `src/modules/expenses/pages/ExpensesWorkspace.tsx`
    - `requests` consume `ExpensesWorkspacePage`.
  - `tests/e2e/expenses-sidebar-plan-gating.spec.ts`
    - Nuevo e2e para gating en sidebar.

## Validacion ejecutada

- Backend
  - `npx vitest run tests/integration/expenses/expenses.plan-gating.routes.test.ts` ✅
  - Nota: `npm run test:integration` completo arrastra fallas preexistentes no relacionadas en otros modulos.

- Frontend
  - `npm run typecheck` ✅
  - `npm run test:e2e -- tests/e2e/expenses-sidebar-plan-gating.spec.ts` ✅
  - `npm run test:e2e -- tests/e2e/expenses-critical-flow.spec.ts` ✅

## DoD de la ola

- [x] Gating por plan aplicado en backend para modulo `expenses`.
- [x] Sidebar refleja disponibilidad real de modulo por plan/permisos.
- [x] Workspace de requests mejorado con filtros y acciones rapidas.
- [x] Pruebas de integracion/e2e de gating ejecutadas y verdes.
- [x] Documentacion de cierre registrada y alineada en espejo backend/frontend.

## Pendientes (siguiente ola sugerida)

1. Aplicar la misma validacion de plan-gating a exportacion/reporting cross-module donde corresponda.
2. Incorporar observabilidad especifica del workspace (`queue filter usage`, latencia por endpoint de expenses).
3. Anadir pruebas de accesibilidad focalizadas para controles de filtros y estados disabled en sidebar.
