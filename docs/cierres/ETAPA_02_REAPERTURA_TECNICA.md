# Reapertura Tecnica Etapa 2

Fecha: 2026-03-09  
Motivo: Hardening del flujo publico de verificacion de email

## 1. Hallazgos que motivan la reapertura

- `register` reutilizaba el mismo endpoint publico para reenviar verificacion sobre cuentas `pending_verification`
- el flujo publico podia filtrar estado de cuenta y metadata de usuario
- el reenvio de verificacion no existia como contrato OpenAPI explicito
- el control anti abuso estaba limitado a rate-limit por IP

## 2. Correcciones aplicadas

- `POST /api/v1/auth/register` pasa a responder un acknowledgement publico endurecido
- se agrega `POST /api/v1/auth/resend-verification` como flujo explicito
- `register` deja de reenviar implicitamente verificacion sobre cuentas existentes
- `resend-verification` responde siempre generico y aplica cooldown por email normalizado
- `verify-email` documenta token invalido, expirado, reemplazado o ya usado
- las cuentas `pending_verification` antiguas quedan con politica explicita de permanencia controlada: login bloqueado, sin reciclaje por `register` y limpieza solo por operacion planificada
- se agrega cobertura de privacidad, no-enumeracion, resend y lifecycle del token

## 3. Evidencia principal

- runtime: `src/core/platform/auth/services/auth.service.ts`
- rutas/controlador: `src/core/platform/auth/routes/auth.routes.ts`, `src/core/platform/auth/controllers/auth.controller.ts`
- contrato: `openapi/paths/auth/register.yaml`, `openapi/paths/auth/resend-verification.yaml`, `openapi/paths/auth/verify-email.yaml`
- pruebas nuevas:
  - `tests/integration/auth/auth.register.privacy.test.ts`
  - `tests/integration/auth/auth.resend-verification.routes.test.ts`

## 4. Verificacion ejecutada

- `npm run test -- tests/unit/core/platform/auth/auth.service.test.ts tests/integration/auth/auth.routes.test.ts tests/integration/auth/auth.runtime.test.ts tests/integration/auth/auth.advanced.routes.test.ts tests/integration/auth/auth.delivery-flow.test.ts tests/integration/auth/auth.email-delivery.integration.test.ts tests/integration/auth/auth.register.privacy.test.ts tests/integration/auth/auth.resend-verification.routes.test.ts`
- `npm run test`
- `npm run build`
- `npm run openapi:validate`

## 5. Resultado

Etapa 2 queda endurecida en su superficie publica de verificacion de email, con menor riesgo de enumeracion, contrato explicito para reenvio de verificacion y evidencia automatizada completa verde en la suite del repositorio.

## 6. Reapertura tecnica complementaria

Fecha: 2026-03-10  
Motivo: cerrar deuda en gestion de claves (forgot/reset/change password) bajo contrato OpenAPI y reglas browser/headless.

### 6.1 Correcciones aplicadas

- se agregan rutas publicas `POST /api/v1/auth/forgot-password` y `POST /api/v1/auth/reset-password`
- se agrega ruta protegida `POST /api/v1/auth/change-password` con `Bearer` o cookie-auth + CSRF
- se incorpora `PasswordResetDeliveryPort` para despacho externo del token de reset
- se agrega template transaccional `reset-password`
- se extiende `user_security` con `passwordResetTokenHash` y `passwordResetExpiresAt`
- `reset-password` revoca sesiones activas y limpia lockout
- `change-password` revoca sesiones hermanas (mantiene la sesion actual)

### 6.2 Evidencia

- runtime:
  - `src/core/platform/auth/services/auth.service.ts`
  - `src/core/platform/auth/routes/auth.routes.ts`
  - `src/core/platform/auth/controllers/auth.controller.ts`
  - `src/infrastructure/security/auth-delivery.registry.ts`
- contrato:
  - `openapi/paths/auth/forgot-password.yaml`
  - `openapi/paths/auth/reset-password.yaml`
  - `openapi/paths/auth/change-password.yaml`
  - `openapi/components/schemas/auth.yaml`
- pruebas:
  - `tests/integration/auth/auth.password-management.routes.test.ts`
  - `tests/unit/core/communications/email/email-template.service.test.ts`
  - `tests/unit/infrastructure/security/auth-delivery.registry.test.ts`

### 6.3 Verificacion ejecutada

- `npm run docs:cierres:validate`
- `npm run openapi:validate`
- `npm run build`
- `npm run lint`
- `npm run test`

### 6.4 Resultado

La deuda tecnica de password management en Etapa 2 queda corregida y re-cerrada con evidencia automatizada verde.
