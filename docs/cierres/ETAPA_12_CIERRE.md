# Cierre Etapa 12

Fecha: 2026-03-09  
Estado: Cerrada (email delivery transaccional)

## 1. Alcance implementado

- plantillas versionadas para `verify-email` e invitaciones tenant
- refinamiento visual de plantillas a `1.1.0` con estilo corporativo email-safe y copy en espanol
- renderer server-side `subject/html/text`
- Mailpit local para `development` y `test`
- Resend como provider productivo
- readiness de `production` actualizada para email delivery real
- reintento explicito para verificacion de email:
  - reenvio de verificacion via `POST /api/v1/auth/resend-verification` para usuario `pending_verification` elegible
  - regeneracion/reenvio de invitacion al repetir `createInvitation` sobre invitacion `pending`

## 2. Evidencia de codigo

- `src/core/communications/email/`
- `src/infrastructure/email/`
- `src/infrastructure/security/auth-delivery.registry.ts`
- `src/infrastructure/tenant/tenant-invitation.registry.ts`
- `src/core/platform/auth/services/auth.service.ts`
- `src/core/tenant/services/tenant.service.ts`
- `src/config/env.ts`
- `src/infrastructure/operations/go-live-readiness.ts`

## 3. Evidencia automatizada

- `npm run build`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test`
- `npm run openapi:validate`

Suites nuevas destacadas:

- `tests/unit/core/communications/email/email-template.service.test.ts`
- `tests/unit/infrastructure/email/mailpit-email.transport.test.ts`
- `tests/unit/infrastructure/email/resend-email.transport.test.ts`
- `tests/unit/infrastructure/email/email-delivery.registry.test.ts`
- `tests/integration/auth/auth.email-delivery.integration.test.ts`
- `tests/integration/tenant/tenant-invitation.email-delivery.integration.test.ts`

## 4. Evidencia contractual

- se agrega `POST /api/v1/auth/resend-verification` para hardening del flujo publico de verify-email
- `verify-email` e invitaciones tenant mantienen el contrato de "secure external channel"
- los tokens siguen fuera de responses HTTP
- OpenAPI actualiza la superficie auth y permanece valido
- el refinamiento visual no modifica el contrato de variables ni el flujo de negocio

## 5. Evidencia operacional

- guia local: `docs/operaciones/MAILPIT_LOCAL_GUIDE.md`
- runbook provider: `docs/operaciones/EMAIL_PROVIDER_RUNBOOK.md`
- compose local: `docker/mailpit/docker-compose.yml`
- scripts locales:
  - `npm run mailpit:up`
  - `npm run mailpit:down`

## 6. Refinamiento de plantillas

- layout HTML reusable con `inline CSS` y estructura email-safe basada en tablas
- textos operativos en espanol para mayor consistencia con el producto
- CTA principales:
  - `Verificar correo`
  - `Aceptar invitacion`
- fallback manual de enlace para clientes con soporte parcial de botones o estilos
