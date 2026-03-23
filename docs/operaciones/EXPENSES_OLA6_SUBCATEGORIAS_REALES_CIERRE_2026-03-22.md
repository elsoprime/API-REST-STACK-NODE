# Expenses - Ola 6 Subcategorias Reales (Backend) - Cierre 2026-03-22

## Objetivo

Implementar subcategorias como entidad real tenant-scoped en Expenses, con contrato HTTP/OpenAPI formal y cobertura de integracion.

## Alcance ejecutado

1. Se agrego modelo persistente `expense_subcategories` con indices por tenant y categoria.
2. Se implemento capa de servicio para crear, listar y actualizar subcategorias.
3. Se expusieron endpoints REST para subcategorias con validacion zod y control RBAC existente del modulo.
4. Se documentaron rutas y schemas en OpenAPI.
5. Se agrego suite de integracion dedicada para rutas de subcategorias.

## Cambios implementados

- `src/modules/expenses/models/expense-subcategory.model.ts`
  - Nuevo modelo Mongoose para subcategorias.
- `src/modules/expenses/types/expenses.types.ts`
  - Nuevas vistas e interfaces de entrada/salida para subcategorias.
- `src/modules/expenses/schemas/expenses.schemas.ts`
  - Nuevos schemas de query/body/params para subcategorias.
- `src/modules/expenses/services/expenses.service.ts`
  - Nuevos metodos `createSubcategory`, `listSubcategories`, `updateSubcategory`.
  - Integridad: categoria debe existir y estar activa.
  - Auditoria: eventos `expenses.subcategory.create` y `expenses.subcategory.update`.
- `src/modules/expenses/controllers/expenses.controller.ts`
  - Nuevos handlers para create/list/update de subcategorias.
- `src/modules/expenses/routes/expenses.routes.ts`
  - Nuevas rutas:
    - `POST /api/v1/modules/expenses/subcategories`
    - `GET /api/v1/modules/expenses/subcategories`
    - `PATCH /api/v1/modules/expenses/subcategories/:subcategoryId`
- `openapi/paths/modules/expenses-subcategories.yaml`
  - Path item para create/list.
- `openapi/paths/modules/expenses-subcategory-by-id.yaml`
  - Path item para update.
- `openapi/components/schemas/expenses.yaml`
  - Schemas de subcategoria y respuestas asociadas.
- `openapi/openapi.yaml`
  - Registro de paths de subcategorias.
- `tests/integration/expenses/expenses.test-helpers.ts`
  - Extensiones de helper para contrato de subcategorias.
- `tests/integration/expenses/expenses.subcategories.routes.test.ts`
  - Cobertura de create/list/update + validaciones base.

## Evidencia de validacion

- `npm run lint` -> passing
- `npm run build` -> passing
- `npm run openapi:validate` -> passing
- `npx vitest run tests/integration/expenses/expenses.subcategories.routes.test.ts` -> 4/4 passing

## DoD Ola 6 (alcance backend de esta ola)

- [x] Entidad de subcategoria implementada en persistencia.
- [x] Endpoints tenant-scoped para create/list/update disponibles.
- [x] Contrato OpenAPI actualizado para subcategorias.
- [x] Cobertura de integracion backend en verde.
- [x] Build, lint y validacion OpenAPI en verde.
- [x] Cierre operativo documentado en `docs/operaciones/`.

## Pendientes explicitos para siguiente ola

1. Enlazar selector jerarquico categoria/subcategoria en formulario runtime frontend.
2. Definir estrategia formal de compatibilidad para datos historicos basados en key.
3. Cerrar espejo documental y funcional en frontend con misma granularidad de DoD.
