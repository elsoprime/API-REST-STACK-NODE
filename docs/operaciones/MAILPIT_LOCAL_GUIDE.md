# Mailpit Local Guide

## 1. Objetivo

Levantar un inbox local reproducible para `development` y `test` durante la Etapa 12 de email transaccional.

## 2. Comandos

Levantar Mailpit:

```bash
npm run mailpit:up
```

Detener Mailpit:

```bash
npm run mailpit:down
```

## 3. Puertos por defecto

- SMTP: `127.0.0.1:1025`
- UI HTTP: `http://localhost:8025`

## 4. Variables locales relevantes

- `EMAIL_PROVIDER=mailpit`
- `EMAIL_FROM=no-reply@localhost.test`
- `AUTH_VERIFY_EMAIL_URL=http://localhost:3000/auth/verify-email`
- `TENANT_INVITATION_ACCEPT_URL=http://localhost:3000/tenant/invitations/accept`
- `EMAIL_MAILPIT_SMTP_HOST=127.0.0.1`
- `EMAIL_MAILPIT_SMTP_PORT=1025`

## 5. Verificacion minima

1. Registrar un usuario nuevo.
2. Crear una invitacion tenant.
3. Verificar que ambos correos aparezcan en la UI de Mailpit.
4. Confirmar que ni la API HTTP ni los logs expongan tokens en responses.
