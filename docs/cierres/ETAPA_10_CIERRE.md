# Cierre Etapa 10

Fecha: 2026-03-08  
Estado: Cerrada (validada)

## 1. Alcance previsto

La Etapa 10 incorpora `HR` como modulo tenant-scoped para gestion de personal y compensaciones.

Incluye:

- `employees` con create/list/get/update/delete (soft delete esperado en runtime)
- `compensation` por empleado con get/update
- aislamiento tenant por `X-Tenant-Id` + resolucion tenant-scoped
- control de acceso por rol para datos personales y salariales
- redaccion de sensibles en auditoria/logs
- validacion anticiclo de jerarquias (`managerId`)
- validaciones laborales minimas en contrato y validacion de dominio

## 2. Evidencia de codigo

Activos documentales y contractuales publicados en este borrador:

- [ADR_HR_PRIVACIDAD_Y_ACCESO.md](..\adrs\ADR_HR_PRIVACIDAD_Y_ACCESO.md)
- [hr.yaml](..\..\openapi\components\schemas\hr.yaml)
- [hr-employees.yaml](..\..\openapi\paths\modules\hr-employees.yaml)
- [hr-employee-by-id.yaml](..\..\openapi\paths\modules\hr-employee-by-id.yaml)
- [hr-compensation-by-employee.yaml](..\..\openapi\paths\modules\hr-compensation-by-employee.yaml)
- [openapi.yaml](..\..\openapi\openapi.yaml)

Implementacion runtime completada:

- `src/modules/hr/*` (models, schemas, service, controller, routes, types)
- integracion de permisos/modulo/plan HR en catalogo RBAC
- redaccion de sensibles ampliada para HR (salarial y personal) en politica de auditoria

## 3. Evidencia automatizada

Comandos contractuales ejecutados:

- `npm run openapi:validate`
- `npm run build`
- `npm run lint`
- `npm run test`

## 4. Evidencia de contrato

Contrato OpenAPI publicado:

- `GET /api/v1/modules/hr/employees`
- `POST /api/v1/modules/hr/employees`
- `GET /api/v1/modules/hr/employees/{employeeId}`
- `PATCH /api/v1/modules/hr/employees/{employeeId}`
- `DELETE /api/v1/modules/hr/employees/{employeeId}`
- `GET /api/v1/modules/hr/employees/{employeeId}/compensation`
- `PATCH /api/v1/modules/hr/employees/{employeeId}/compensation`

Reglas de contrato aplicadas:

- todas las rutas requieren autenticacion valida
- `X-Tenant-Id` es obligatorio en rutas tenant-scoped
- mutaciones exponen `X-CSRF-Token` opcional en contrato HTTP
- respuestas exitosas usan envelope `success/data/traceId` o `success/data/pagination/traceId`
- errores usan el envelope global `success: false` con `error.code` estable
- requests y schemas HR incluyen minimos laborales obligatorios y semantica `anyOf/required` para updates

## 5. Veredicto

La Etapa 10 queda cerrada con evidencia ejecutable de contrato, calidad y seguridad:

- contrato OpenAPI HR publicado y validado
- runtime HR implementado con tenant isolation, RBAC fino, CSRF en mutaciones y anticiclo jerarquico
- redaccion de sensibles HR activa en auditoria
- pruebas unit/integration HR y suite global en verde

## 6. Reapertura tecnica y re-cierre

Fecha: 2026-03-10  
Estado: Re-cierre tecnico aplicado

### 6.1 Motivo

Se detecto deuda tecnica contractual en hardening tenant-scoped y evidencia CSRF/OpenAPI de mutaciones HR.

### 6.2 Fix realizado

- `hr.service` aplica fail-closed por mismatch entre `input.tenantId` y `context.tenant.tenantId` en mutaciones con `TENANT_SCOPE_MISMATCH` (`400`).
- se agrego cobertura unitaria para mismatch de tenant context en operaciones mutables HR.
- se agrego cobertura de integracion CSRF para `POST /api/v1/modules/hr/employees` en modo cookie-auth (caso rechazo y caso aceptado).
- OpenAPI HR de mutaciones explicita la condicion de `X-CSRF-Token` para cookie-auth vs Bearer.

### 6.3 Evidencia automatizada del re-cierre

- `npm run docs:cierres:validate` âœ…
- `npm run openapi:validate` âœ…
- `npm run build` âœ…
- `npm run lint` âœ…
- `npm run test` âœ… (`98` archivos en verde, `1` skipped por feature flag de restore drill)

