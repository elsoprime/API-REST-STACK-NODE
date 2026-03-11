# Matriz de Deprecacion Documental Frontend

Version: 1.2.0
Estado: Activo
Ultima actualizacion: 2026-03-11

## 1. Objetivo

Clasificar la documentacion de `docs/frontend/*` para eliminar ruido, conservar solo fuentes utiles y definir reemplazos explicitos antes de implementar la guia V2.

## 2. Regla de decision

- Vigente: documento valido y alineado con OpenAPI/runtime.
- Vigente con correccion: documento util, pero con secciones obsoletas o inconsistentes.
- Deprecado controlado: documento que ya no debe usarse como fuente principal; se mantiene en `_deprecated` para trazabilidad y redireccion.

## 3. Matriz

| Documento | Estado | Motivo | Accion |
|---|---|---|---|
| `README.md` | Vigente | Indice oficial de `docs/frontend` | Mantener y actualizar referencia principal a V2 |
| `10_IMPLEMENTATION_GUIDE_V2.md` | Vigente | Guia principal por fases y etapas, incluyendo billing/provisioning | Fuente principal para ejecucion FE |
| `_deprecated/90_INTEGRATION_PLAN_V1.md` | Deprecado controlado | Referencias historicas y rol superado por V2 | Mantener en `_deprecated` con redireccion a V2 |
| `20_ACCESS_MATRIX.md` | Vigente | Matriz alineada con OpenAPI vigente, incluyendo billing/provisioning | Mantener sincronizada por cambios de contrato |
| `30_API_CLIENT_STANDARD.md` | Vigente | Reglas de headers y clasificacion de rutas actualizadas | Mantener y validar contra cliente real |
| `40_STATE_AND_CACHE_POLICY.md` | Vigente | Base de aislamiento tenant/cache actualizada con provisioning | Mantener |
| `50_ERROR_CATALOG.md` | Vigente con correccion | Faltaban codigos de password reset/change | Completar codigos y acciones UX |
| `60_MOCKING_GUIDE.md` | Vigente | Incluye escenarios de billing/provisioning en MSW | Mantener |
| `70_E2E_CRITICAL_FLOWS.md` | Vigente | Flujos criticos incluyen provisioning billing | Mantener |
| `80_BACKEND_DEPENDENCIES.md` | Vigente | Dependencias cerradas/abiertas actualizadas | Mantener trazabilidad |
| `90_DOD_CHECKLIST.md` | Vigente | Criterios de cierre incluyen billing/provisioning | Mantener |

## 4. Inconsistencias detectadas y tratamiento

### 4.1 Referencias internas obsoletas

Ajustar rutas documentales antiguas que aun apuntan a:

- `docs/integration/*`
- `docs/FRONTEND_*`
- `docs/cierre/*`

Reemplazar por:

- `docs/frontend/*`
- `docs/cierres/*`

### 4.2 OpenAPI ya disponible, pero marcado como faltante en frontend docs

Corregir menciones de ausencia para:

- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/checkout/session`
- `POST /api/v1/billing/webhooks/provider`
- `PATCH /api/v1/tenant/subscription`
- `DELETE /api/v1/tenant/subscription`

### 4.3 Dependencias que siguen realmente abiertas

Mantener como abiertas solo las dependencias con contrato/runtime aun faltante para FE:

- Memberships tenant CRUD (`/api/v1/tenant/memberships*`)
- Gestion publica de roles/permisos tenant
- Exposicion formal de auditoria platform-scoped para frontend
- Endpoint de documentacion runtime (si se exige como requisito operativo)

## 5. Politica de mantenimiento

1. Toda nueva guia principal entra en `docs/frontend` y debe declararse en `README.md`.
2. Todo documento deprecado debe moverse a `docs/frontend/_deprecated/` con referencia al reemplazo oficial.
3. Si hay conflicto entre documentos frontend, gana:
   1. `openapi/openapi.yaml` + `openapi/paths/*`
   2. `10_IMPLEMENTATION_GUIDE_V2.md`
   3. documentos especializados (`ACCESS_MATRIX`, `API_CLIENT_STANDARD`, `ERROR_CATALOG`, etc.)

