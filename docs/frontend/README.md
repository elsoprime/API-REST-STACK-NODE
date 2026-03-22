# Documentacion Frontend

## Fuente de verdad

- Contrato API: `openapi/openapi.yaml`
- Guia principal de implementacion FE: `docs/frontend/10_IMPLEMENTATION_GUIDE_V2.md`
- Matriz de estado documental: `docs/frontend/95_DOCS_DEPRECATION_MATRIX.md`
- Evidencia de etapas/cierres: `docs/cierres/*`
- Cierres operativos modulares: `docs/operaciones/*`

## Estructura del directorio

- `docs/frontend/*.md` -> documentos vigentes para operacion
- `docs/frontend/_deprecated/*` -> documentos deprecados mantenidos solo para trazabilidad
- `docs/operaciones/*.md` -> cierres operativos, runbooks y propuestas por modulo

## Indice documental

- `10_IMPLEMENTATION_GUIDE_V2.md`
  Manual principal por fases y etapas (API -> Frontend).
- `95_DOCS_DEPRECATION_MATRIX.md`
  Estado de cada documento frontend (vigente/corregir/deprecado).
- `15_INVENTORY_MODULO_IMPLEMENTATION_GUIDE_V2.md`
  Guia operativa especifica para implementar el modulo Inventario escalable en Frontend.
- `20_ACCESS_MATRIX.md`
  Matriz ruta UI -> endpoint -> permiso -> modulo/plan.
- `30_API_CLIENT_STANDARD.md`
  Estandar unico de cliente HTTP (CSRF, tenant header, refresh, traceId).
- `40_STATE_AND_CACHE_POLICY.md`
  Politica de estado global, cache, invalidacion y aislamiento tenant.
- `50_ERROR_CATALOG.md`
  Catalogo `error.code` -> mensaje UX -> accion -> retry.
- `60_MOCKING_GUIDE.md`
  Guia de mocks con MSW alineada a OpenAPI.
- `70_E2E_CRITICAL_FLOWS.md`
  Suite E2E minima para flujos criticos.
- `80_BACKEND_DEPENDENCIES.md`
  Backlog formal de bloqueos frontend dependientes de backend.
- `90_DOD_CHECKLIST.md`
  Definition of Done para historias, pantallas y modulos frontend.
- `docs/operaciones/RETOMADA_CHECKLIST.md`
  Checklist corto para retomar cambios desde `main`, `wip/*` o una nueva rama `feat/*`.
- `docs/operaciones/*.md`
  Cierres operativos, handoff y propuestas modulares de implementacion (incluye Expenses).
- `_deprecated/90_INTEGRATION_PLAN_V1.md`
  Documento deprecado controlado, mantenido solo para trazabilidad.

## Reglas de gobernanza

- Mantener la documentacion de integracion frontend centralizada en esta carpeta.
- Si un endpoint no esta en `openapi/`, tratarlo como inexistente para trabajo frontend.
- Toda actualizacion de contrato backend debe reflejarse en OpenAPI antes de ajustar docs/frontend.
- Mantener una sola guia principal activa: `10_IMPLEMENTATION_GUIDE_V2.md`.

## Flujo de actualizacion

1. Confirmar cambio en runtime y OpenAPI.
2. Actualizar guia V2 si cambia flujo funcional o estrategia por fases.
3. Actualizar documento especializado afectado (`ACCESS_MATRIX`, `ERROR_CATALOG`, etc.).
4. Actualizar matriz de deprecacion si cambia estado de algun documento.
5. Si se depreca un documento, moverlo a `docs/frontend/_deprecated/`.
6. Vincular el PR a secciones modificadas de `docs/frontend`.