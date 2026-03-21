# Matriz de Deprecacion Documental Frontend

Version: 1.3.0
Estado: Activo
Ultima actualizacion: 2026-03-20

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
| `10_IMPLEMENTATION_GUIDE_V2.md` | Vigente | Guia principal por fases y etapas, incluyendo members y seguridad de plataforma | Fuente principal para ejecucion FE |
| `_deprecated/90_INTEGRATION_PLAN_V1.md` | Deprecado controlado | Referencias historicas y rol superado por V2 | Mantener en `_deprecated` con redireccion a V2 |
| `20_ACCESS_MATRIX.md` | Vigente | Matriz alineada con OpenAPI/runtime vigente, incluyendo memberships CRUD y `settings/security` | Mantener sincronizada por cambios de contrato |
| `30_API_CLIENT_STANDARD.md` | Vigente | Reglas de headers y clasificacion de rutas actualizadas | Mantener y validar contra cliente real |
| `40_STATE_AND_CACHE_POLICY.md` | Vigente | Base de aislamiento tenant/cache actualizada con provisioning | Mantener |
| `50_ERROR_CATALOG.md` | Vigente con correccion | Debe reflejar codigos nuevos de memberships y seguridad | Completar codigos y acciones UX |
| `60_MOCKING_GUIDE.md` | Vigente con correccion | Debe marcar retiro de mocks en `Members > Equipo` cuando frontend integre el runtime real | Actualizar junto con la integracion FE |
| `70_E2E_CRITICAL_FLOWS.md` | Vigente con correccion | Debe incorporar escenarios criticos de memberships y `settings/security` | Ampliar cobertura cuando frontend conecte los nuevos contratos |
| `80_BACKEND_DEPENDENCIES.md` | Vigente | Dependencias cerradas/abiertas actualizadas | Mantener trazabilidad |
| `90_DOD_CHECKLIST.md` | Vigente | Criterios de cierre siguen validos | Mantener |
| `100_ALIGNMENT_PLAN_BACKEND_FRONTEND_TENANT_WORKSPACES.md` | Vigente con correccion | Acta de cierre y trazabilidad de alineacion ya ejecutada | Mantener como registro; usar `10_IMPLEMENTATION_GUIDE_V2.md` y `20_ACCESS_MATRIX.md` como fuente operativa |
| `operaciones/BILLING_LOCAL_DEMO_RUNBOOK.md` | Vigente | Runbook operativo para cierre practico checkout -> webhook -> activacion | Mantener y actualizar junto a cambios de billing/provisioning |

## 4. Inconsistencias detectadas y tratamiento

### 4.1 Referencias internas obsoletas

Ajustar rutas documentales antiguas que aun apuntan a:

- `docs/integration/*`
- `docs/FRONTEND_*`
- `docs/cierre/*`

Reemplazar por:

- `docs/frontend/*`
- `docs/cierres/*`

### 4.2 OpenAPI ya disponible, pero marcado como faltante o pendiente en frontend docs

Corregir menciones de ausencia para:

- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/billing/plans`
- `POST /api/v1/billing/checkout/session`
- `POST /api/v1/billing/webhooks/provider`
- `PATCH /api/v1/tenant/subscription`
- `DELETE /api/v1/tenant/subscription`
- `GET /api/v1/tenant/memberships`
- `PATCH /api/v1/tenant/memberships/{membershipId}`
- `DELETE /api/v1/tenant/memberships/{membershipId}`
- `GET /api/v1/platform/settings` para `settings/security`
- `PATCH /api/v1/platform/settings` para `settings/security`

### 4.3 Dependencias que siguen realmente abiertas

Mantener como abiertas solo las dependencias con contrato/runtime aun faltante para FE:

- Gestion publica de roles/permisos tenant
- Exposicion formal de auditoria platform-scoped para frontend
- Endpoint de documentacion runtime (si se exige como requisito operativo)

Nota para evitar ruido documental:

- mientras `Platform Audit` siga siendo una unica dependencia abierta, no crear una guia o plan principal nuevo
- documentar su alcance futuro dentro de `10_IMPLEMENTATION_GUIDE_V2.md`, `70_E2E_CRITICAL_FLOWS.md` y `80_BACKEND_DEPENDENCIES.md`
- crear documento dedicado solo si luego aparecen decisiones de producto o arquitectura que ya no quepan de forma limpia en esas fuentes

## 5. Politica de mantenimiento

1. Toda nueva guia principal entra en `docs/frontend` y debe declararse en `README.md`.
2. Todo documento deprecado debe moverse a `docs/frontend/_deprecated/` con referencia al reemplazo oficial.
3. Si hay conflicto entre documentos frontend, gana:
   1. `openapi/openapi.yaml` + `openapi/paths/*`
   2. `10_IMPLEMENTATION_GUIDE_V2.md`
   3. documentos especializados (`ACCESS_MATRIX`, `API_CLIENT_STANDARD`, `ERROR_CATALOG`, etc.)
