# Expenses - Ola Requests (Create/Update/Submit) - Cierre 2026-03-21

## Objetivo

Habilitar flujo UI end-to-end para `expenses` en frontend: crear solicitud, actualizar solicitud editable y enviar a revision (`submit`) sin salir del workspace.

## Alcance ejecutado

1. Formulario reusable para create/update con validaciones.
2. Modal operativo para crear/editar desde workspace y detalle.
3. Integracion de submit en el mismo flujo del formulario.
4. Actualizacion de estado global UI para orquestar apertura/cierre del formulario.
5. Prueba e2e critica de create+submit.

## Cambios implementados

- Frontend
  - `src/modules/expenses/components/requests/ExpenseRequestForm.tsx`
  - `src/modules/expenses/components/requests/ExpenseRequestFormDrawer.tsx`
  - `src/modules/expenses/pages/ExpensesWorkspacePage.tsx`
  - `src/modules/expenses/pages/ExpenseRequestDetailPage.tsx`
  - `src/modules/expenses/state/expenses.store.ts`
  - `tests/e2e/expenses-request-create-submit.spec.ts`

## Validaciones ejecutadas

- `npm run typecheck` ✅
- `npm run test:e2e -- tests/e2e/expenses-request-create-submit.spec.ts tests/e2e/expenses-critical-flow.spec.ts` ✅

## DoD

- [x] Usuario puede crear solicitud desde workspace.
- [x] Usuario puede guardar borrador y enviar a revision desde el mismo formulario.
- [x] Usuario puede editar solicitud en estado editable (`draft`/`returned`) desde detalle.
- [x] Flujo create-submit cubierto con e2e.
- [x] Documento de cierre alineado en espejo backend/frontend.

## Notas de continuidad

1. Siguiente incremento recomendado: UI para `categories/settings` dentro de tab `settings`.
2. Agregar tests de accesibilidad (focus trap y teclado) para modal de formulario.
