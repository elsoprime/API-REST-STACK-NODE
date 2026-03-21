# Addendum Tecnico - Audit Metrics (2026-03-21)

## 1. Objetivo
Registrar de forma aditiva la extension tecnica `GET /api/v1/audit/metrics` sin alterar el hilo documental canonico ni mezclar alcance con el modulo `expenses`.

## 2. Alcance de este addendum
- Incluye solo contrato y comportamiento tecnico del endpoint tenant-scoped de metricas de auditoria.
- No redefine politicas RBAC generales.
- No reemplaza ni corrige documentos maestros.
- No incorpora cambios de UX ni decisiones de frontend.

## 3. Endpoint
- Metodo: `GET`
- Ruta: `/api/v1/audit/metrics`
- Scope: tenant-scoped
- Permiso: `tenant:audit:read`
- Seguridad: `bearerAuth` o `accessTokenCookie`
- Tenant context: requiere `X-Tenant-Id`

## 4. Query params soportados
- `from` (date-time, requerido)
- `to` (date-time, requerido)
- `granularity` (`day|week`, opcional, default `day`)
- `module` (opcional, CSV o repetido)
- `severity` (opcional, CSV o repetido)
- `topN` (opcional, `1..20`, default `5`)

Validacion relevante:
- `to` debe ser mayor que `from`.

## 5. Respuesta (resumen)
Envelope de exito estandar:
- `success: true`
- `data`
- `traceId`

Bloques principales de `data`:
- `summary`: total actual, criticos, porcentaje critico, total previo, tendencia porcentual.
- `trend`: serie agregada por bucket (`day` o `week`).
- `severityDistribution`: distribucion porcentual por severidad.
- `topActions`: acciones mas frecuentes.
- `topModules`: modulos mas frecuentes.

## 6. Criterios de compatibilidad
- Cambio aditivo: no rompe `GET /api/v1/audit` existente.
- No introduce cambios en payloads previos.
- Consumidores existentes de listado permanecen compatibles.

## 7. Riesgos tecnicos acotados
- Drift FE/API si frontend no sincroniza OpenAPI espejo en una etapa posterior.
- Carga de agregaciones en ventanas muy amplias (mitigable por filtros de rango y `topN`).

## 8. Mitigacion recomendada
1. Mantener este cambio en PR aislada de `expenses`.
2. Ejecutar build backend en CI para validar tipos/runtime.
3. Sincronizar OpenAPI FE/API en PR separada cuando corresponda al frente frontend.
4. Mantener este addendum como referencia operativa, sin modificar docs canonicas por ahora.

## 9. Evidencia tecnica asociada
Archivos backend tocados para esta extension:
- `src/core/platform/audit/routes/audit.routes.ts`
- `src/core/platform/audit/controllers/audit.controller.ts`
- `src/core/platform/audit/schemas/audit.schemas.ts`
- `src/core/platform/audit/services/audit.service.ts`
- `src/core/platform/audit/types/audit-query.types.ts`
- `src/core/platform/audit/types/audit.types.ts`
- `openapi/paths/audit/metrics.yaml`
- `openapi/components/schemas/audit.yaml`
- `openapi/components/schemas/_index.yaml`
- `openapi/openapi.yaml`

Estado de verificacion local:
- `npm run build` en backend: OK.
