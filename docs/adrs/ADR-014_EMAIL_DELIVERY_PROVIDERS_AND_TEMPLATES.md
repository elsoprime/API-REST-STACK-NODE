# ADR-014

## Titulo

Estrategia de email transaccional con plantillas personalizadas y proveedores por entorno.

## Estado

Aprobada e implementada

## Fecha

2026-03-09

## Contexto

El core actual ya define puertos de delivery para secretos operativos y mantiene la regla de no exponer secretos por API publica.  
Tambien existe guardia de go-live para exigir configuracion de delivery en `production`.

Falta cerrar de forma explicita:

- motor de plantillas de correo
- provider de desarrollo/test reproducible
- provider productivo recomendado y sus alternativas

## Decision

- Crear Etapa 12 para comunicaciones transaccionales de email.
- Mantener patron de puertos/adaptadores para delivery.
- En `development` y `test`, usar Mailpit sobre Docker para captura e inspeccion local de correos.
- En `production`, usar proveedor real con Resend como opcion por defecto.
- Permitir proveedores equivalentes (por ejemplo SES, Postmark o Mailgun) mediante adaptador compatible, sin cambiar contrato de dominio.
- Mantener plantillas versionadas en el repositorio (subject/html/text) con render server-side y variables controladas.
- Refinar las plantillas transaccionales con copy operativo en espanol y HTML corporativo email-safe usando `inline CSS`.
- Mantener el branding en nivel plataforma para este corte; el branding dinamico por tenant queda fuera del ADR.

## Consecuencias

- se agregan variables de entorno especificas de provider/transporte
- se amplian pruebas unitarias e integracion para templating y delivery
- la readiness de `production` debe validar configuracion real del provider de email
- no se habilita implementacion inmediata por este ADR; se requiere plan de ejecucion aprobado

## Alternativas consideradas

1. Continuar solo con webhook generico

- Ventaja: menor cambio inmediato.
- Desventaja: no define estandar de plantillas ni contrato operativo de provider.

2. SMTP unico para todos los entornos

- Ventaja: simplicidad conceptual.
- Desventaja: peor ergonomia y observabilidad para produccion, mas friccion en deliverability.

3. Provider API primero (Resend) + Mailpit local

- Ventaja: buen balance entre experiencia local, trazabilidad y salida a produccion.
- Desventaja: dependencia externa en entorno productivo.

## Nota de implementacion

Implementacion consolidada el 2026-03-09:

- `verify-email` y `tenant-invitation` evolucionan a plantillas `1.1.0`
- el contenido pasa a espanol con CTA explicitos e instrucciones manuales de fallback
- el HTML usa layout reusable compatible con clientes de correo sin depender de CSS externo

## Cierre de decision

La alternativa 3 queda implementada y documentada en la Etapa 12.
