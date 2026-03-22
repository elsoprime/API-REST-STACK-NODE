# Expenses - Ola Settings Hardening (Permisos + Ciclo de vida categorias) - Cierre 2026-03-21

## Objetivo

Endurecer `tab=settings` de Expenses con comportamiento robusto por permisos y ciclo de vida de categorias.

## Alcance ejecutado

1. Categorias: se agrego accion de desactivar/reactivar (`isActive`) desde UI.
2. Settings: se formalizo modo solo lectura para roles sin `tenant:expenses:settings:update`.
3. Mensajeria UX explicita de denegacion de edicion.
4. E2E negativo por permisos (sin update).
5. E2E critico ampliado para ciclo de vida de categoria (crear/editar/desactivar).

## Cambios implementados

- Frontend
  - `src/modules/expenses/components/settings/ExpenseCategoriesManager.tsx`
  - `src/modules/expenses/components/settings/ExpenseModuleSettingsForm.tsx`
  - `tests/e2e/expenses-settings-critical.spec.ts`
  - `tests/e2e/expenses-settings-permissions.spec.ts`

## Validaciones ejecutadas

- `npm run typecheck` ✅
- `npm run test:e2e -- tests/e2e/expenses-settings-critical.spec.ts tests/e2e/expenses-settings-permissions.spec.ts tests/e2e/expenses-critical-flow.spec.ts` ✅

## DoD

- [x] Categorias soportan toggle `Activo/Inactivo` desde UI.
- [x] Roles sin permiso de update ven settings en modo solo lectura.
- [x] Se evita mutacion desde UI cuando falta permiso.
- [x] E2E negativo por permisos implementado y verde.
- [x] E2E critico de settings ampliado y verde.
- [x] Documentacion espejo backend/frontend actualizada.

## Pendiente recomendado

1. Agregar auditoria de cambios en categorias/settings a nivel UI (event timeline en frontend).
2. Validar errores de negocio de limite mensual por categoria con casos e2e dedicados.
