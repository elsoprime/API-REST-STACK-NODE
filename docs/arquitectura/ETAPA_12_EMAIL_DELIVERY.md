# Etapa 12 - Comunicaciones Transaccionales (Email Delivery)

Estado: Implementada  
Fecha de registro: 2026-03-09

## 1. Objetivo

Cerrar la capacidad de envio de correos transaccionales con plantillas personalizadas, manteniendo los contratos de seguridad ya definidos:

- secretos fuera de responses HTTP
- secretos fuera de logs
- delivery por puertos/adaptadores

## 2. Alcance del corte

- email de verificacion de cuenta (`verify-email`)
- email de invitacion tenant (continuidad del puerto existente)
- plantillas versionadas en el repositorio (subject/html/text)
- estrategia por entorno:
  - `development` y `test`: Mailpit en Docker
  - `production`: proveedor real (Resend por defecto) o equivalente aprobado
- pruebas unitarias e integracion para transporte y render de plantillas
- readiness de produccion alineada con `go-live`

## 3. No alcance mantenido

- alta de nuevos endpoints de negocio
- automatizacion de marketing o correos no transaccionales

## 4. Dependencias

- Etapa 11 cerrada
- ADR-014 aprobado antes de ejecutar implementacion
- variables de entorno formalizadas para provider, remitente y transporte

## 5. Criterios de inicio

- plan de archivos y orden de implementacion aprobado
- contrato de plantillas y campos dinamicos definido
- decision final de provider productivo documentada

## 6. Criterios de cierre ejecutados

- evidencia de codigo en adaptadores y plantillas
- evidencia automatizada (`build`, `test`, `openapi:validate`, suites nuevas de email)
- evidencia contractual (sin exposicion de secretos, sin romper OpenAPI)
- evidencia operacional (guia Mailpit local, runbook de provider productivo, readiness en `production`)
- evidencia de presentacion transaccional:
  - plantillas HTML email-safe con `inline CSS`
  - copy operativo en espanol para `verify-email` e invitaciones tenant
  - CTA y fallback manual de enlace para clientes de correo con soporte parcial

## 7. Decision de implementacion

Implementacion realizada con estas decisiones:

- `verify-email` e invitaciones tenant usan plantillas versionadas `subject/html/text`
- las plantillas evolucionan a una variante corporativa en espanol (`1.1.0`) manteniendo el mismo contrato de variables
- `development` y `test` usan Mailpit por SMTP local
- `production` usa Resend como provider inicial
- 2FA permanece fuera de este pipeline y conserva delivery externo dedicado
- la entrega es sincronica post-transaccion, pero `register` e invitaciones soportan reintento implicito para estados pendientes

Evidencia consolidada:

- `docs/cierres/ETAPA_12_CIERRE.md`
