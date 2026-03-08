# ANEXO 01

## Identidad y Auth · Etapa 2

Prerequisito: Etapas -1, 0 y 1 cerradas.

## 1. Contrato de autenticacion

### Browser

- access token en cookie HttpOnly `AUTH_ACCESS_COOKIE_NAME`
- refresh token en cookie HttpOnly `REFRESH_TOKEN_COOKIE_NAME`
- mutaciones autenticadas por cookie requieren `X-CSRF-Token`
- login responde metadata de usuario y sesion, no el access token en body

### Headless

- `Authorization: Bearer <accessToken>`
- login headless puede retornar `{ accessToken, refreshToken }`
- refresh headless se documenta explicitamente en OpenAPI

### Regla operacional

El refresh token no autentica rutas protegidas. Solo autentica rotacion de sesion.

## 2. Claims minimos

- `sub`
- `sid`
- `scope`
- `tenantId?`
- `membershipId?`

No se usa `tenantId` como fuente de verdad universal. Si la ruta exige `X-Tenant-Id`, el header manda.

## 3. Modelos base

- `users`
- `user_security`
- `auth_sessions`

Reglas:

- `user_security` nunca se serializa a API
- `auth_sessions.refreshTokenHash` siempre se hashea
- `AUTH_ACCOUNT_LOCKED` queda incorporado al catalogo global

## 4. Middleware authenticate

Precedencia:

1. `Authorization: Bearer`
2. cookie `AUTH_ACCESS_COOKIE_NAME`

No debe leer ni aceptar `REFRESH_TOKEN_COOKIE_NAME`.

## 5. Flujos obligatorios

- register
- verify email
- login
- refresh con rotacion
- logout individual
- logout all
- 2FA setup/confirm/disable
- recovery codes
- bloqueo por intentos fallidos

## 6. OpenAPI

Debe distinguir claramente:

- login browser
- login headless
- refresh browser
- refresh headless
- rutas publicas
- rutas protegidas

## 7. Riesgos cerrados por esta version

- contradiccion access token cookie vs body
- middleware leyendo una cookie no definida
- mezcla entre access y refresh
- CSRF ambiguo

## 8. Aclaraciones de implementacion

- `verify-email` entrega su token por `EmailVerificationDeliveryPort`
- `2FA setup` entrega su secreto y `otpauthUrl` por `TwoFactorProvisioningPort`
- `development` y `test` usan adaptadores `in-memory` inspeccionables por tests
- `production` requiere cablear un adaptador real antes de go-live
- los secretos operativos de verify-email, TOTP y recovery codes no forman parte del contrato publico de la API
- 2FA se implementa con TOTP y recovery codes hasheados en `user_security`
- el bloqueo por intentos fallidos aplica sobre login por password y responde con `AUTH_ACCOUNT_LOCKED`
