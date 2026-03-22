# Expenses - Ola Settings (Categorias + Politicas) - Cierre 2026-03-21

## Objetivo

Implementar `tab=settings` operativo para expenses con dos bloques productivos:
- Gestion de categorias (listar/crear/editar)
- Configuracion del modulo (approval mode, limites, monedas, export)

## Alcance ejecutado

1. Se extendio la capa API frontend para categorias y settings.
2. Se agregaron tipos y mappers para `ExpenseCategory` y `ExpenseSettings`.
3. Se implemento `ExpenseCategoriesManager` con CRUD operativo minimo.
4. Se implemento `ExpenseModuleSettingsForm` con persistencia real contra API.
5. Se reemplazo placeholder de `settings` en workspace por UI funcional.
6. Se agrego e2e critico de settings/categorias.

## Cambios implementados

- Frontend
  - `src/lib/api/expenses.types.ts`
  - `src/lib/api/expenses.mappers.ts`
  - `src/lib/api/expenses.client.ts`
  - `src/lib/query/query-keys.ts`
  - `src/modules/expenses/components/settings/ExpenseCategoriesManager.tsx`
  - `src/modules/expenses/components/settings/ExpenseModuleSettingsForm.tsx`
  - `src/modules/expenses/pages/ExpensesWorkspace.tsx`
  - `tests/e2e/expenses-settings-critical.spec.ts`

## Validaciones ejecutadas

- `npm run typecheck` ✅
- `npm run test:e2e -- tests/e2e/expenses-settings-critical.spec.ts` ✅
- `npm run test:e2e -- tests/e2e/expenses-critical-flow.spec.ts` ✅

## DoD

- [x] `tab=settings` deja de ser placeholder y pasa a ser operativo.
- [x] Categorias se pueden listar, crear y editar desde UI.
- [x] Settings del modulo se pueden leer y actualizar desde UI.
- [x] E2E critico de settings implementado y verde.
- [x] Cierre documentado en espejo backend/frontend.

## Pendiente recomendado

1. Incorporar acciones avanzadas de categorias: desactivar/reactivar y limites por categoria con validaciones adicionales.
2. Agregar cobertura e2e para permisos denegados (`SETTINGS_UPDATE` ausente).
