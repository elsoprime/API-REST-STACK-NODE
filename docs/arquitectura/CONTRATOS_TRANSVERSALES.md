# Contratos Transversales

## 1. Rutas

- Health: `GET /health`
- API versionada: `/api/v1/*`
- Ningun endpoint de negocio vive fuera de `/api/v1`

## 2. Exitos

- Todas las respuestas exitosas usan `buildSuccess()` o `buildPaginatedSuccess()`
- Toda respuesta incluye `traceId`

## 3. Errores

Forma unica:

```ts
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
  traceId: string
}
```

Reglas:

- `code` es estable
- `message` puede evolucionar, no el `code`
- `details` solo se usa para validacion o errores estructurados
- no se responden strings sueltos

## 4. Auth

### Browser

- Access token: cookie HttpOnly `AUTH_ACCESS_COOKIE_NAME`
- Refresh token: cookie HttpOnly `REFRESH_TOKEN_COOKIE_NAME`
- Mutaciones autenticadas por cookie requieren `X-CSRF-Token`
- `refresh` rota el refresh token
- `authenticate` valida access token, nunca refresh token

### Headless

- `Authorization: Bearer <accessToken>`
- refresh segun contrato del endpoint headless

### Claims minimos del access token

- `sub`
- `sid`
- `scope`
- `tenantId?`
- `membershipId?`

El claim `tenantId` solo existe si el token fue emitido para un tenant activo.

Los endpoints platform-scoped autorizan contra permisos explicitados en `scope` hasta que exista un modelo persistido de identidad administrativa de plataforma.

## 5. Tenant context

- Toda ruta tenant-scoped requiere `X-Tenant-Id` salvo que el token ya venga tenant-bound y el endpoint lo permita explicitamente
- `resolveTenantContext` debe validar:
  - tenant existente
  - tenant activo
  - membership activa
  - rol resoluble

## 6. RBAC

- `roles` es la fuente de verdad para roles sistema y custom
- `memberships` no hardcodea jerarquias fuera del motor RBAC
- `requireRole` resuelve jerarquia desde metadata del rol
- `requirePermission` es obligatorio para permisos atomicos
- `platform:super_admin` bypass solo donde el contrato lo declare

## 7. Auditoria

- Antes de `AuditContext`, auth y tenant pueden propagar `ExecutionContext` serializable como costura base
- La auditoria no depende de `Request`
- El servicio recibe un `AuditContext` serializable
- El alcance auditable puede ser `tenant` o `platform`
- `before` y `after` pasan por redaccion/allowlist antes de persistirse
- `audit_logs` son inmutables
- Sin `session`, la captura durable usa `audit_outbox`
- La consulta HTTP de auditoria es tenant-scoped, requiere `X-Tenant-Id` y `tenant:audit:read`

## 8. OpenAPI

- Si no esta en `openapi/`, no existe
- Se documenta antes de implementarse
- Error schema y success envelopes deben reflejar exactamente el contrato runtime

## 9. Testing

- Todo cierre exige tests automatizados
- Los tests de tenant isolation, auth y guards no son opcionales
- Las pruebas que dependan de transacciones corren sobre Mongo replica set
