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
