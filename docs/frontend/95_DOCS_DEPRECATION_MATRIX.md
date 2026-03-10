# Matriz de Deprecacion Documental Frontend

Version: 1.1.0
Estado: Activo
Ultima actualizacion: 2026-03-10

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
| `10_IMPLEMENTATION_GUIDE_V2.md` | Vigente | Nueva guia principal por fases y etapas | Fuente principal para ejecucion FE |
| `_deprecated/90_INTEGRATION_PLAN_V1.md` | Deprecado controlado | Referencias historicas y rol superado por V2 | Mantener en `_deprecated` con redireccion a V2 |
| `20_ACCESS_MATRIX.md` | Vigente con correccion | Tiene seccion desalineada con OpenAPI actual | Corregir cobertura de endpoints y mantener como matriz de acceso |
| `30_API_CLIENT_STANDARD.md` | Vigente con correccion | Requiere precision de excepciones tenant/token-bound | Ajustar reglas de headers y consumo por ruta |
| `40_STATE_AND_CACHE_POLICY.md` | Vigente | Base solida de aislamiento tenant/cache | Mantener |
| `50_ERROR_CATALOG.md` | Vigente con correccion | Faltaban codigos de password reset/change | Completar codigos y acciones UX |
| `60_MOCKING_GUIDE.md` | Vigente | Alineado con OpenAPI y MSW | Mantener |
| `70_E2E_CRITICAL_FLOWS.md` | Vigente | Flujos criticos claros para release gate | Mantener |
| `80_BACKEND_DEPENDENCIES.md` | Vigente con correccion | Tenia bloqueos ya resueltos por backend | Actualizar estado de dependencias |
| `90_DOD_CHECKLIST.md` | Vigente | Criterios claros de cierre y calidad | Mantener |

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

