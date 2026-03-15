# Runbook Go-Live (Etapa 11)

## 1. Objetivo

Ejecutar despliegues y rollback de forma segura, agnostica a infraestructura, preservando contratos:

- `GET /health`
- `/api/v1/*`
- error envelope y success envelope oficiales
- aislamiento tenant por `X-Tenant-Id`

## 2. Prerrequisitos minimos

- Etapas `-1` a `8` cerradas
- Etapas `9` y `10` cerradas si entran en el release comprometido
- variables de entorno validadas al arranque
- adaptadores productivos cableados:
  - `EMAIL_PROVIDER=resend`
  - `EMAIL_FROM`
  - `AUTH_VERIFY_EMAIL_URL`
  - `TENANT_INVITATION_ACCEPT_URL`
  - `EMAIL_RESEND_API_KEY`
  - `AUTH_TWO_FACTOR_PROVISIONING_WEBHOOK_URL`
  - `BILLING_WEBHOOK_SECRET` custom
  - `REDIS_URL`
  - en `production`, las URLs de delivery deben usar `https://`

## 3. Preflight obligatorio

Ejecutar antes del despliegue:

```bash
npm run go-live:check
```

El preflight falla si:

- build/lint/openapi no pasan
- smoke suite o restore drill fallan
- readiness de adaptadores productivos no cumple en `production`

## 4. Despliegue

1. Publicar artefacto de la version objetivo.
2. Aplicar variables de entorno del release.
3. Iniciar proceso Node.js del nuevo release.
4. Verificar logs de `app.start`, `app.readiness`, `app.dependencies` y `app.ready`.
5. Ejecutar smoke suite contra staging/canary antes de expandir trafico.

## 5. Validacion post-deploy

- `GET /health` responde `200`
- `data.ready=true` y `data.checks.database=true`
- `data.checks.productionDeliveryAdapters=true` en `production`
- rutas criticas no devuelven `404`
- trazabilidad con `traceId` en headers/respuestas
- una respuesta representativa bajo `/api/v1/*` expone `Content-Security-Policy`, `X-Content-Type-Options` y `X-Frame-Options`
- el header `x-powered-by` no aparece en respuestas de la API
- no existen warnings persistentes `rate_limiter.redis.fallback` en logs del release

## 6. Rollback

1. Detener envio de trafico nuevo a la version fallida.
2. Restaurar version estable previa.
3. Verificar `/health` y smoke suite minima.
4. Si hubo corrupcion/borrado de datos, ejecutar drill de restore y luego restore operativo real.
5. Documentar incidente y causa raiz.

## 7. Restore drill

Evidencia automatizada minima:

```bash
npm run test:restore
```

Restore real en Mongo (staging/go-live):

```bash
ENABLE_MONGODB_RESTORE_DRILL=true npm run test:restore:mongodb
```

Flujo local reproducible:

- ver [MONGO_LOCAL_RESTORE_DRILL.md](.\MONGO_LOCAL_RESTORE_DRILL.md)

El drill valida:

- artefacto restorable con metadata
- recuperacion de registros criticos tras mutaciones destructivas
- preservacion de limites cross-tenant
- restauracion real sobre MongoDB de test (`restore.mongodb-drill.test.ts`) cuando `ENABLE_MONGODB_RESTORE_DRILL=true`

## 8. Criterios de abortar go-live

- `go-live:check` falla
- `/health` reporta `ready=false` de forma persistente
- errores `5xx` sostenidos en flujos criticos
- redaccion/auditoria no cumplen contrato
## 9. Evidencia de gates (corte 2026-03-15)

Validaciones ejecutadas para consolidacion de salida tecnica:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test` -> OK
- `npm run test:coverage` -> OK
- `npm run openapi:validate` -> OK
- `npm run docs:cierres:validate` -> OK

Nota operativa:

- Este bloque registra evidencia de un corte especifico y no reemplaza el criterio permanente del runbook.



## 10. Runbook local: demo de pago simulado (checkout -> webhook -> activacion)

Objetivo: validar el flujo operativo real sin bypass de pago en entorno local.

Prerequisitos minimos:

- backend corriendo en `APP_URL` (ejemplo: `http://localhost:4000`)
- `BILLING_WEBHOOK_SECRET` definido en `.env`
- sesion owner del tenant para crear checkout

Secuencia recomendada:

1. Crear checkout en `POST /api/v1/billing/checkout/session` desde UI (`/app/settings/billing`).
2. Tomar `checkoutSessionId` de la respuesta.
3. Simular webhook paid:

```bash
npm run billing:webhook:simulate -- --tenant-id=<tenantId> --checkout-session-id=<checkoutSessionId> --plan-id=<planId> --provider=simulated --type=billing.checkout.paid
```

4. Revalidar runtime en `GET /api/v1/tenant/settings/effective` con `X-Tenant-Id`.
5. Confirmar activacion en UI (`/app/settings/billing` -> `Verificar activacion`).

Resultados esperados:

- antes del webhook: `TENANT_SUBSCRIPTION_PAYMENT_REQUIRED` es valido en flujos restringidos
- despues del webhook paid: runtime efectivo activo y modulos habilitados segun plan