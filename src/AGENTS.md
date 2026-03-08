# AGENTS.md — Backend

## Scope

`/src`

## Fuente de verdad

- `docs/PLAN_MAESTRO.md`
- `docs/arquitectura/CONTRATOS_TRANSVERSALES.md`
- `docs/arquitectura/ENTORNOS_Y_RESILIENCIA.md`
- `docs/anexos/ANEXO_00_FUNDACIONES.md`
- `docs/anexos/ANEXO_01_IDENTIDAD_AUTH.md`
- `docs/anexos/ANEXO_02_TENANT_MEMBERSHIPS.md`
- `docs/anexos/ANEXO_03_SEGURIDAD_RBAC.md`
- `docs/anexos/ANEXO_04_05_SETTINGS.md`
- `docs/anexos/ANEXO_06_07_08_09_MODULOS_OPS.md`

## Contratos a respetar

### Errores

```ts
{
  success: false,
  error: { code, message, details? },
  traceId,
}
```

### Auth

- browser: cookies `AUTH_ACCESS_COOKIE_NAME` y `REFRESH_TOKEN_COOKIE_NAME`
- headless: bearer
- `authenticate` valida access token
- el refresh token nunca autentica rutas protegidas

### Tenant

- `X-Tenant-Id` es obligatorio en rutas tenant-scoped
- todo query tenant-scoped incluye `tenantId`

### Entornos y resiliencia

- `NODE_ENV` soporta `development`, `test` y `production`
- la configuracion se valida en `src/config/env.ts`
- la conexion a infraestructura critica usa retries acotados al arranque
- `production` falla rapido si la DB no esta disponible al iniciar
- el proceso debe soportar graceful shutdown

### RBAC

- `roles` es la fuente de verdad
- `requirePermission` es guard principal para recursos
- `requireRole` no puede depender solo de jerarquias hardcodeadas

## Reglas de codigo

- `strict: true`
- sin `any` en runtime salvo justificacion documentada
- controllers delgados
- servicios sin `req` ni `res`
- repositorios sin logica de negocio
- auditoria basada en `AuditContext`, no en `Request`
