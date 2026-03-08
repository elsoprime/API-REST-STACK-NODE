# Documentacion Frontend

## Fuente de verdad

- Contrato principal de integracion frontend: `docs/frontend/FRONTEND_INTEGRATION_PLAN_V1.md`
- Contrato API: `openapi/openapi.yaml`
- Estado de etapas y evidencia de cierre: `docs/cierres/*`

## Indice documental

- `FRONTEND_INTEGRATION_PLAN_V1.md`  
  Guia maestra de integracion (contratos, endpoints, roadmap, UX operacional).
- `FRONTEND_ACCESS_MATRIX.md`  
  Matriz ruta UI -> endpoint -> permiso -> modulo/plan.
- `FRONTEND_ERROR_CATALOG.md`  
  Catalogo `error.code` -> mensaje UX -> accion -> politica de retry.
- `FRONTEND_STATE_AND_CACHE_POLICY.md`  
  Politica de estado global, cache, invalidacion y aislamiento tenant.
- `FRONTEND_API_CLIENT_STANDARD.md`  
  Estandar unico de cliente HTTP (CSRF, tenant header, refresh, traceId).
- `FRONTEND_MOCKING_GUIDE.md`  
  Guia de mocks con MSW alineada a OpenAPI.
- `FRONTEND_E2E_CRITICAL_FLOWS.md`  
  Suite E2E minima para flujos criticos.
- `FRONTEND_BACKEND_DEPENDENCIES.md`  
  Backlog formal de bloqueos frontend dependientes de backend.
- `FRONTEND_DOD_CHECKLIST.md`  
  Definition of Done para historias, pantallas y modulos frontend.

## Reglas de gobernanza

- Mantener la documentacion de integracion frontend centralizada en esta carpeta.
- No crear guias maestras paralelas en otras carpetas sin aprobacion explicita.
- Si un endpoint no esta en `openapi/`, tratarlo como inexistente para trabajo frontend.
- Todo cambio de API backend debe actualizar:
  - `openapi/*`
  - `docs/frontend/FRONTEND_INTEGRATION_PLAN_V1.md`
- Mantener una sola guia maestra operativa (`FRONTEND_INTEGRATION_PLAN_V1.md`) y documentos complementarios definidos en este indice.

## Flujo de actualizacion

1. Confirmar el cambio en codigo runtime y OpenAPI.
2. Actualizar documentos afectados segun alcance del cambio.
3. Marcar explicitamente nuevos bloqueos o requerimientos no implementados.
4. Vincular el PR a las secciones modificadas de esta carpeta.
