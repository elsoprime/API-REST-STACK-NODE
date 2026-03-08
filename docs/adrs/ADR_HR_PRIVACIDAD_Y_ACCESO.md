# ADR HR Privacidad y Acceso

Fecha: 2026-03-08

## Estado

Aprobado

## Contexto

La Etapa 10 (HR) del roadmap indica que el modulo no puede iniciar sin una politica de privacidad cerrada.

HR incorpora datos personales y salariales, por lo que requiere decisiones explicitas para:

- control de acceso por rol para PII y compensacion
- redaccion de campos sensibles en logs y auditoria
- reglas anticiclo en jerarquias de reporte
- validaciones laborales minimas en altas y actualizaciones

## Decision

Se define la politica contractual de HR con los siguientes puntos:

1. El modulo HR no se considera iniciable ni cerrable sin politica de privacidad documentada y aprobada.
2. El acceso a datos personales y salariales se controla por permisos/roles, con separacion explicita entre lectura general de empleados y lectura/actualizacion de compensacion.
3. Los campos sensibles (personales y salariales) deben pasar por politica de redaccion antes de persistirse en auditoria o de emitirse en logs.
4. La relacion jerarquica entre empleados debe aplicar validacion anticiclo para impedir que un empleado termine, directa o indirectamente, reportandose a si mismo.
5. Las validaciones laborales minimas quedan en el contrato del modulo: identidad laboral (`employeeCode`), datos basicos, tipo de empleo y fecha de ingreso, mas metadatos minimos de compensacion.
6. El contrato OpenAPI de HR se publica bajo `/api/v1/modules/hr` con `X-Tenant-Id` obligatorio, autenticacion `bearerAuth/accessTokenCookie` y `X-CSRF-Token` opcional en mutaciones.

## Consecuencias

- Se reduce el riesgo de exposicion accidental de datos sensibles en trazas operativas.
- Se separan claramente permisos funcionales y permisos salariales para menor privilegio.
- Se previenen inconsistencias organizacionales por ciclos jerarquicos.
- Se habilita una base contractual verificable para implementacion backend y pruebas de Etapa 10.
