# Email Provider Runbook

## 1. Objetivo

Definir la configuracion minima de provider productivo para email transaccional en Etapa 12.

## 2. Provider soportado en production

- `EMAIL_PROVIDER=resend`

## 3. Variables obligatorias en production

- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM=no-reply@example.com`
- `AUTH_VERIFY_EMAIL_URL=https://app.example.com/auth/verify-email`
- `TENANT_INVITATION_ACCEPT_URL=https://app.example.com/tenant/invitations/accept`
- `EMAIL_RESEND_API_KEY=<secret>`
- `EMAIL_RESEND_API_BASE_URL=https://api.resend.com`
- `AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL=https://delivery.example.com/2fa`

## 4. Semantica operativa aceptada

- `verify-email` e invitaciones tenant usan delivery sincronico post-transaccion.
- si el envio falla, la operacion puede repetirse:
  - `register` solo crea cuentas nuevas y responde con acknowledgement endurecido
  - `resend-verification` reemite token solo para cuentas `pending_verification` elegibles, con respuesta publica generica
  - `createInvitation` regenera token y reenvia si existe una invitacion `pending`
- `resend-verification` aplica cooldown por email normalizado y rate-limit por email/IP
- 2FA permanece fuera del pipeline HTML de Etapa 12 y sigue usando delivery externo dedicado.

## 5. Observabilidad minima

- logs con `scope=email.delivery`
- metadata segura:
  - `provider`
  - `semantic`
  - `templateKey`
  - `templateVersion`
  - `messageId`
- sin exponer HTML, text, destinatarios ni tokens
