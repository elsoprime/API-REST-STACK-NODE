# Expenses - Cierre Ola 5

Fecha de cierre: 2026-03-21  
Ambito: backend `API-REST-STACK-NODE` (modulo `expenses`)

## 1. Objetivo de la ola

Cerrar integracion y QA de API para `expenses` sin generar ruido documental en guias normativas y dejando trazabilidad para handoff frontend.

## 2. Cambios implementados

- Nuevas suites de integracion:
  - `tests/integration/expenses/expenses.test-helpers.ts`
  - `tests/integration/expenses/expenses.workflow.routes.test.ts`
  - `tests/integration/expenses/expenses.attachments.routes.test.ts`
  - `tests/integration/expenses/expenses.bulk.routes.test.ts`
  - `tests/integration/expenses/expenses.reporting.routes.test.ts`
- Correccion de enrutamiento:
  - `src/modules/expenses/routes/expenses.routes.ts`
  - Reorden de rutas `POST /requests/bulk/*` antes de `POST /requests/:requestId/*` para evitar colisiones de matching.

## 3. Evidencia de validacion

Comando ejecutado:

`npm test -- tests/integration/expenses/expenses.workflow.routes.test.ts tests/integration/expenses/expenses.attachments.routes.test.ts tests/integration/expenses/expenses.bulk.routes.test.ts tests/integration/expenses/expenses.reporting.routes.test.ts`

Resultado:

- 4 archivos de test en verde
- 17 tests passing
- 0 fallos en las suites de `expenses`

## 4. DoD de Ola 5 (backend)

Estado: Cumplido

- [x] Cobertura de rutas criticas de `expenses` en integracion:
  - workflow
  - attachments/presign
  - bulk
  - reporting/export
- [x] Validaciones de contrato HTTP verificadas (`400` en payload/params invalidos).
- [x] Trazabilidad de bug real capturada y corregida (colision de rutas bulk vs parametricas).
- [x] Sin cambios en documentacion normativa (`PLAN_MAESTRO`, arquitectura, ADRs).
- [x] Artefacto de cierre generado para retomada posterior.

## 5. Riesgos y pendientes

- La matriz RBAC efectiva actual permite acciones de workflow/reporting para `tenant:member`; verificar si ese comportamiento es intencional de producto.
- La integracion frontend de Ola 5 queda pendiente en repositorio espejo.

## 6. Handoff recomendado a frontend

- Consumir solamente endpoints publicados en OpenAPI de `expenses`.
- Priorizar vistas:
  - bandeja (`queue`)
  - detalle y workflow
  - adjuntos
  - bulk actions
- Reusar escenarios de backend para E2E frontend y evitar divergencia de contrato.
