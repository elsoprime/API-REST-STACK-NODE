# Plan Maestro

## API-REST-STACK-NODE Â· SaaS Core Engine V3

Version: 2.1.0
Estado: Activo  
Ultima revision: 2026-03-12

## 1. Proposito

Este documento es la fuente de verdad central del repositorio `API-REST-STACK-NODE`.

Su objetivo no es describir una vision aspiracional, sino dejar una base ejecutable y verificable para construir el backend por etapas sin contradicciones de contrato, seguridad ni arquitectura.

## 2. Principios no negociables

- Un solo lugar de verdad por concepto.
- Ningun endpoint existe fuera de OpenAPI.
- Ninguna etapa se cierra sin evidencia ejecutable.
- No se crea documentacion nueva si un documento canonico existente cubre el cambio.
- Todo recurso tenant-scoped filtra por `tenantId`.
- Los secretos nunca se exponen ni en respuestas ni en logs.
- Los servicios no dependen de `req` ni `res`.
- Toda decision estructural se registra en ADR.
- La configuracion por entorno y la resiliencia operativa son parte de la arquitectura.

## 3. Fuente de verdad documental

- Referencia central: [PLAN_MAESTRO.md](.\PLAN_MAESTRO.md)
- Plan de remediacion Integracion REPO: [PLAN_REMEDIACION_INTEGRACION_REPO.md](.\PLAN_REMEDIACION_INTEGRACION_REPO.md)
- Contratos transversales: [CONTRATOS_TRANSVERSALES.md](.\arquitectura\CONTRATOS_TRANSVERSALES.md)
- Estructura objetivo del repo: [ESTRUCTURA_REPO_OBJETIVO.md](.\arquitectura\ESTRUCTURA_REPO_OBJETIVO.md)
- Bootstrap real del repo: [ETAPA_-1_BOOTSTRAP.md](.\arquitectura\ETAPA_-1_BOOTSTRAP.md)
- Politica operativa: [ENTORNOS_Y_RESILIENCIA.md](.\arquitectura\ENTORNOS_Y_RESILIENCIA.md)
- Criterios de cierre: [CRITERIOS_DE_CIERRE.md](.\checklists\CRITERIOS_DE_CIERRE.md)
- ADRs: [ADRs.md](.\adrs\ADRs.md)

Los anexos de `docs/anexos/` desarrollan cada bloque funcional, pero no pueden contradecir este documento ni los contratos transversales.

### 3.1 Nomenclatura canonica de cierres

La nomenclatura oficial para documentos de cierre vive en `docs/checklists/CRITERIOS_DE_CIERRE.md` y sigue el patron:

- `ETAPA_{ID}_{TIPO}.md`

Reglas clave:

- `ID`: `M1`, `00..12` o `00_01`
- `TIPO`: `CIERRE`, `REAPERTURA_TECNICA`, `EVIDENCIA_RELEASE`
- la etapa `-1` se mantiene canonica en `docs/arquitectura/ETAPA_-1_BOOTSTRAP.md`
- no se genera ruido documental: se prioriza actualizar documentos existentes sobre crear nuevos archivos

## 4. Stack base

- Runtime: Node.js LTS
- Lenguaje: TypeScript 5.x con `strict: true`
- HTTP: Express 4.x
- DB: MongoDB 7.x con replica set obligatorio
- ODM: Mongoose 8.x
- Validacion: Zod 3.x
- Testing: Vitest + Supertest
- Logging: Pino
- Contrato API: OpenAPI 3.1

## 5. Contratos cerrados

### 5.1 Respuesta exitosa

```json
{
  "success": true,
  "data": {},
  "traceId": "uuid"
}
```

### 5.2 Respuesta de error

```json
{
  "success": false,
  "error": {
    "code": "GEN_VALIDATION_ERROR",
    "message": "Mensaje estable para desarrollo",
    "details": {
      "field": ["detalle"]
    }
  },
  "traceId": "uuid"
}
```

La forma canonical del error es:

- `success: false`
- `error.code`
- `error.message`
- `error.details?`
- `traceId`

Queda descartado cualquier formato alternativo como `{ code, error, message }`.

### 5.3 Auth

- Browser first:
  - access token en cookie HttpOnly dedicada
  - refresh token en cookie HttpOnly separada
  - CSRF double-submit obligatorio en requests mutables autenticados por cookie
- Headless:
  - Bearer access token
  - refresh token fuera de cookie, segun contrato del endpoint headless
- Cookie de access token: `AUTH_ACCESS_COOKIE_NAME`
- Cookie de refresh token: `REFRESH_TOKEN_COOKIE_NAME`
- Las rutas protegidas autentican desde access token, nunca desde refresh token

### 5.4 Multitenancy

- Todo recurso tenant-scoped lleva `tenantId`
- Todo query tenant-scoped filtra por `tenantId`
- `X-Tenant-Id` es obligatorio en rutas tenant-scoped salvo switch/token explicitamente tenant-bound
- Las pruebas de aislamiento cross-tenant son requisito de cierre

## 6. Variables de entorno obligatorias

Minimo contractual:

- `NODE_ENV`
- `PORT`
- `APP_NAME`
- `APP_VERSION`
- `APP_URL`
- `FRONTEND_URL`
- `MONGODB_URI`
- `MONGODB_URI_TEST`
- `MONGODB_MAX_POOL_SIZE`
- `MONGODB_CONNECT_TIMEOUT_MS`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN`
- `AUTH_ACCESS_COOKIE_NAME`
- `REFRESH_TOKEN_COOKIE_NAME`
- `COOKIE_SECRET`
- `COOKIE_DOMAIN`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `CSRF_SECRET`
- `CSRF_COOKIE_NAME`
- `BCRYPT_SALT_ROUNDS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_GLOBAL`
- `RATE_LIMIT_MAX_AUTH`
- `RATE_LIMIT_MAX_SENSITIVE`
- `CORS_ORIGINS`
- `LOG_LEVEL`
- `LOG_PRETTY`
- `DB_CONNECT_MAX_RETRIES`
- `DB_CONNECT_RETRY_DELAY_MS`

## 7. Etapas

### Etapa -1

Bootstrap del repositorio y del entorno. Sin esta etapa no existe base verificable.

### Etapa 0

Fundaciones HTTP y gobernanza:

- Express
- router raiz
- healthcheck
- logger
- traceId
- error handler
- OpenAPI base

### Etapa 1

Persistencia y utilidades compartidas:

- conexion MongoDB
- schema/env validation
- constantes
- helpers comunes
- middlewares de validacion
- base document plugin

### Etapa 2

Platform identity y auth:

- users
- user_security
- auth_sessions
- register/login/refresh/logout
- 2FA
- CSRF

### Etapa 3

Tenant core:

- tenants
- memberships
- invitations
- switch de tenant

### Etapa 4

Motor de autorizacion y politicas:

- roles
- permissions
- scopes
- plans
- modules
- feature flags base

### Etapa 5

Auditoria y observabilidad:

- audit logs
- trazabilidad
- redaccion de sensibles
- consulta segura

Primer corte recomendado:

- `ExecutionContext` serializable previo a auditoria
- `AuditContext`
- factory o resolver de contexto auditable
- politica de redaccion
- persistencia inmutable de `audit_logs`
- evidencia automatizada de escritura, redaccion y aislamiento tenant

### Etapa 6

Settings platform.

Primer corte recomendado:

- singleton `PlatformSettings`
- bootstrap on-demand con proteccion contra duplicados
- lectura y actualizacion auditada
- permisos platform-scoped explicitos en `scope`

### Etapa 7

Settings tenant.

Incluye:

- singleton `TenantSettings` por tenant
- bootstrap on-demand con proteccion contra duplicados
- lectura tenant-scoped
- actualizacion auditada
- vista efectiva resuelta sobre `PlatformSettings`, plan y estado global
- la vista efectiva tenant nunca bootstrappea ni muta `PlatformSettings`
- la resolucion runtime efectiva se delega al motor RBAC como unica fuente de verdad

### Etapa 8

Inventory como modulo piloto.

### Etapa 9

CRM. Solo entra al roadmap activo si Inventory valida el core.

### Etapa 10

HR. Solo entra al roadmap activo si Inventory valida el core y existe politica de privacidad cerrada.

### Etapa 11

Hardening y Go-Live.

Prerequisito minimo:

- Etapas -1 a 8 cerradas
- Etapas 9 y 10 cerradas solo si forman parte del release objetivo

### Etapa 12

Comunicaciones transaccionales (email delivery).

Objetivo del corte:

- delivery de correo con plantillas personalizadas
- estrategia por entorno (`development/test` con Mailpit en Docker, `production` con proveedor real como Resend o equivalente)
- continuidad de contrato seguro: secretos fuera de responses y logs

Estado actual:

- etapa implementada con plantillas versionadas y provider por entorno
- evidencia de cierre en `docs/cierres/ETAPA_12_CIERRE.md`

Prerequisito minimo:

- Etapa 11 cerrada formalmente
- ADR de delivery de email aprobado antes de implementacion

## 8. Decisiones estructurales cerradas

- `GET /health` vive fuera de `/api/v1`
- OpenAPI publica `/api/v1/*` para negocio y `/health` para salud
- `Inventory` es el modulo piloto de validacion del core
- Go-Live no depende obligatoriamente de CRM/HR
- Los roles custom deben ser compatibles desde Etapa 4, no injertados en Etapa 7
- El ownership de tenant se modela con `ownerUserId` y se proyecta como autorizacion efectiva sobre RBAC; no se aceptan dos fuentes de verdad contradictorias
- Los claims autenticados que identifican recursos Mongo deben validarse como `ObjectId` al entrar al runtime HTTP
- Antes de Etapa 5, auth y tenant deben poder propagar `ExecutionContext` serializable sin depender de `Request` o `Response`
- Las transacciones multi-documento requieren replica set desde desarrollo local
- La API soporta `development`, `test` y `production` como entornos formales
- La configuracion se valida al arranque
- `production` falla rapido si MongoDB critica no esta disponible durante startup
- Los reintentos de conexion son acotados y configurables

## 9. Riesgos dominantes

- Deriva documental entre plan, anexos y prompts
- Contrato de auth ambiguo
- RBAC rigido incompatible con roles custom
- Pruebas imposibles de ejecutar por ausencia de bootstrap
- Concurrencia no resuelta en stock e invitaciones
- Falta de modelo de privacidad para HR

## 10. Regla de cierre

Ninguna etapa se considera cerrada por narrativa. Solo se cierra con evidencia definida en [CRITERIOS_DE_CIERRE.md](.\checklists\CRITERIOS_DE_CIERRE.md).


## 11. Remediacion Integracion REPO (2026-03-12)

Orden de ejecucion adoptado para cerrar hallazgos del informe de auditoria de integracion:

1. Gobernanza y baseline (ADRs + reaperturas + gates en verde).
2. Ciclo de vida tenant/suscripcion con activacion condicionada a pago.
3. Hardening de webhooks (firma nativa, anti-replay e idempotencia).
4. RBAC granular en inventory y rol tenant:admin.
5. Hardening operativo (CORS efectivo, rate limit distribuido, observabilidad de billing).
6. Re-cierre formal con evidencia automatizada y acoplamiento FE/API.

Fuente de ejecucion detallada: [PLAN_REMEDIACION_INTEGRACION_REPO.md](.\PLAN_REMEDIACION_INTEGRACION_REPO.md).


