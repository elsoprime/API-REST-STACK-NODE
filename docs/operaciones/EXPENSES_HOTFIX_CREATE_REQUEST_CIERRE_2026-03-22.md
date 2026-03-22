# Expenses Hotfix Create Request Cierre 2026-03-22

## Objetivo

Corregir la brecha de runtime en creacion de solicitudes (`create-request`) causada por desalineacion de formato en `expenseDate` entre frontend y backend.

## Cambios aplicados

- Frontend serializa `expenseDate` desde `YYYY-MM-DD` a `YYYY-MM-DDT00:00:00.000Z` antes de enviar payload.
- Se agrega cobertura de integracion backend para contrato de fecha:
  - rechaza `date-only` (400)
  - acepta `date-time` ISO valido (201)
- Se agrega validacion E2E frontend para confirmar que el payload enviado en creacion usa formato ISO.

## DoD

- [x] crear solicitud desde UI envia `expenseDate` en formato ISO con offset
- [x] backend mantiene contrato `date-time` sin romper OpenAPI
- [x] test backend cubre rechazo/aceptacion por formato
- [x] E2E frontend cubre payload de creacion
- [x] checklist maestro actualizado con hotfix cerrado

## Validacion ejecutada

- Backend: `npm run lint`, `npm run build`, `npx vitest run tests/integration/expenses/expenses.requests.routes.test.ts`
- Frontend: `npm run lint`, `npm run build`, `npx playwright test tests/e2e/expenses-request-create-submit.spec.ts`

## Notas

Este hotfix no modifica rutas ni contratos OpenAPI del modulo. Es un ajuste de serializacion en cliente para cumplir el contrato existente.
