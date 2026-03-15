# Catalogo de Errores Frontend

Version: 1.3.0  
Estado: Activo  
Ultima actualizacion: 2026-03-13

## 1. Proposito

Estandarizar el manejo UX de `error.code` del backend para mensajes, acciones y politica de reintento en frontend.

## 2. Reglas globales

- Usar `error.code` como fuente principal de decision UX.
- `error.message` se trata como texto tecnico secundario.
- Siempre preservar `traceId` en logs y vistas de soporte.
- No hacer retry automatico salvo donde se indique explicitamente.

## 3. Politica por clase HTTP

| HTTP | Politica UX | Retry automatico |
|---|---|---|
| 400 | Mostrar validaciones de campo o error de entrada | No |
| 401 | Intentar refresh una vez (browser); luego login | Solo refresh browser |
| 403 | Mostrar "sin acceso" / restriccion de cuenta | No |
| 404 | Mostrar "no encontrado" con navegacion | No |
| 409 | Mostrar conflicto y guia de resolucion | No |
| 423 | Mostrar bloqueo temporal/permanente de cuenta | No |
| 429 | Mostrar enfriamiento con retry manual | No |
| 5xx | Mostrar fallo generico y `traceId` | No |

## 4. Catalogo por codigo

### 4.1 Genericos

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `GEN_VALIDATION_ERROR` | `error.validation.generic` | Revisa los datos ingresados. | Corregir campos y reenviar. | No |
| `GEN_NOT_FOUND` | `error.resource.notFound` | El recurso solicitado no existe. | Volver al listado o dashboard. | No |
| `GEN_RATE_LIMITED` | `error.rateLimit` | Demasiadas solicitudes en poco tiempo. | Esperar y reintentar manualmente. | No |
| `GEN_INTERNAL_ERROR` | `error.internal` | Ocurrio un error inesperado. | Reintentar luego o contactar soporte con traceId. | No |

Nota operativa tenant settings:
- Si `GET /api/v1/tenant/settings/effective` responde `GEN_INTERNAL_ERROR`, no aplicar retry en loop desde frontend.
- Si `GET /api/v1/tenant/settings/effective` responde `TENANT_SUBSCRIPTION_PAYMENT_REQUIRED`, mostrar CTA directo a Billing y no aplicar retry en loop.
- Escalar a backend para validar bootstrap de `PlatformSettings` en startup.


### 4.2 Auth

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `AUTH_UNAUTHENTICATED` | `auth.unauthenticated` | Tu sesion no es valida o expiro. | Ir a login. | Refresh browser 1 vez |
| `AUTH_INVALID_CREDENTIALS` | `auth.invalidCredentials` | Credenciales invalidas. | Revisar email/password. | No |
| `AUTH_ACCOUNT_LOCKED` | `auth.accountLocked` | Cuenta temporalmente bloqueada. | Esperar o contactar soporte. | No |
| `AUTH_EMAIL_ALREADY_EXISTS` | `auth.emailExists` | El email ya esta registrado. | Tratarlo como conflicto solo en flujos privados o administrativos; no asumirlo desde `register` publico. | No |
| `AUTH_EMAIL_NOT_VERIFIED` | `auth.emailNotVerified` | Debes verificar tu email. | Completar verificacion. | No |
| `AUTH_EMAIL_VERIFICATION_INVALID` | `auth.emailVerificationInvalid` | Token de verificacion invalido, expirado, reemplazado o ya usado. | Llamar `POST /api/v1/auth/resend-verification` y mostrar confirmacion generica. | No |
| `AUTH_PASSWORD_RESET_INVALID` | `auth.passwordResetInvalid` | El token de recuperacion es invalido o expiro. | Solicitar un nuevo enlace en forgot password. | No |
| `AUTH_PASSWORD_CHANGE_CURRENT_INVALID` | `auth.passwordChangeCurrentInvalid` | La contrasena actual no coincide. | Corregir contrasena actual y reintentar. | No |
| `AUTH_PASSWORD_CHANGE_REUSED` | `auth.passwordChangeReused` | La nueva contrasena no puede ser igual a la actual. | Elegir una contrasena diferente. | No |
| `AUTH_INVALID_REFRESH_TOKEN` | `auth.invalidRefresh` | No se pudo renovar la sesion. | Login de nuevo. | No |
| `AUTH_CSRF_INVALID` | `auth.csrfInvalid` | Tu sesion de seguridad no es valida. | Recargar y reintentar accion. | No |
| `AUTH_TWO_FACTOR_REQUIRED` | `auth.twoFactorRequired` | Se requiere codigo 2FA para continuar. | Ingresar codigo o recovery code. | No |
| `AUTH_TWO_FACTOR_INVALID` | `auth.twoFactorInvalid` | Codigo 2FA invalido. | Reintentar con codigo vigente. | No |
| `AUTH_TWO_FACTOR_ALREADY_ENABLED` | `auth.twoFactorAlreadyEnabled` | 2FA ya esta habilitado. | Refrescar estado de seguridad. | No |
| `AUTH_TWO_FACTOR_NOT_ENABLED` | `auth.twoFactorNotEnabled` | 2FA no esta habilitado. | Habilitar 2FA antes de esta accion. | No |

### 4.3 Tenant

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `TENANT_HEADER_REQUIRED` | `tenant.headerRequired` | Falta contexto de tenant activo. | Seleccionar tenant y reintentar. | No |
| `TENANT_SCOPE_MISMATCH` | `tenant.scopeMismatch` | El scope del request no coincide con la sesion/token actual. | Si es ruta tenant, rehacer switch tenant. Si es ruta platform, usar `platformClient` sin contexto tenant-scoped. | No |
| `TENANT_NOT_FOUND` | `tenant.notFound` | Tenant no encontrado. | Volver a selector tenant. | No |
| `TENANT_INACTIVE` | `tenant.inactive` | El tenant esta inactivo. | Contactar administrador del tenant. | No |
| `TENANT_MEMBERSHIP_REQUIRED` | `tenant.membershipRequired` | No tienes membresia activa en este tenant. | Solicitar acceso. | No |
| `TENANT_MEMBERSHIP_INACTIVE` | `tenant.membershipInactive` | Tu membresia esta inactiva. | Contactar owner/admin. | No |
| `TENANT_ACCESS_DENIED` | `tenant.accessDenied` | No tienes acceso a este tenant. | Volver a tenant permitido. | No |
| `TENANT_OWNER_REQUIRED` | `tenant.ownerRequired` | Esta accion requiere rol owner. | Solicitar operacion a un owner. | No |
| `TENANT_SLUG_ALREADY_EXISTS` | `tenant.slugExists` | El identificador del tenant ya existe. | Elegir otro slug/nombre. | No |
| `TENANT_MEMBER_LIMIT_REACHED` | `tenant.memberLimitReached` | Se alcanzo el limite de miembros del plan. | Actualizar plan o remover miembros. | No |
| `TENANT_SUBSCRIPTION_PAYMENT_REQUIRED` | `tenant.subscriptionPaymentRequired` | La suscripcion del tenant requiere pago. | Ir a Billing (`/app/settings/billing`) y completar pago; luego revalidar runtime efectivo. | No |
| `TENANT_INVITATION_INVALID` | `tenant.invitationInvalid` | Invitacion invalida. | Revisar enlace de invitacion. | No |
| `TENANT_INVITATION_EXPIRED` | `tenant.invitationExpired` | Invitacion expirada. | Solicitar nueva invitacion. | No |
| `TENANT_INVITATION_REVOKED` | `tenant.invitationRevoked` | Invitacion revocada. | Solicitar nueva invitacion. | No |
| `TENANT_INVITATION_ALREADY_ACCEPTED` | `tenant.invitationAccepted` | Invitacion ya utilizada. | Continuar a selector tenant. | No |

Nota operativa de scope:
- `TENANT_SCOPE_MISMATCH` en `/api/v1/platform/settings` indica mezcla de contexto.
- No hacer retry ciego.
- Cambiar a cliente/sesion platform-only y registrar `traceId`.

### 4.4 RBAC y politicas

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `RBAC_ROLE_NOT_FOUND` | `rbac.roleNotFound` | El rol no es valido en este contexto. | Recargar contexto tenant/sesion. | No |
| `RBAC_ROLE_DENIED` | `rbac.roleDenied` | Tu rol no permite esta accion. | Solicitar elevacion de rol. | No |
| `RBAC_PERMISSION_DENIED` | `rbac.permissionDenied` | No tienes permiso para esta accion. | Solicitar permiso requerido. | No |
| `RBAC_PLAN_DENIED` | `rbac.planDenied` | Tu plan actual no habilita esta funcionalidad. | Actualizar plan o usar modulo habilitado. | No |
| `RBAC_MODULE_DENIED` | `rbac.moduleDenied` | El modulo no esta habilitado para tu tenant. | Revisar modulo/plan con owner/admin. | No |

### 4.5 Inventory

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `INV_CATEGORY_ALREADY_EXISTS` | `inventory.categoryExists` | Ya existe una categoria con esos datos. | Ajustar nombre/clave y reenviar. | No |
| `INV_CATEGORY_NOT_FOUND` | `inventory.categoryNotFound` | Categoria no encontrada. | Volver al listado de categorias. | No |
| `INV_CATEGORY_IN_USE` | `inventory.categoryInUse` | No se puede eliminar una categoria en uso. | Reasignar items antes de eliminar. | No |
| `INV_ITEM_ALREADY_EXISTS` | `inventory.itemExists` | Ya existe un item con esos datos. | Ajustar SKU/campos unicos. | No |
| `INV_ITEM_NOT_FOUND` | `inventory.itemNotFound` | Item no encontrado. | Volver al listado de items. | No |
| `INV_STOCK_CONFLICT` | `inventory.stockConflict` | El stock cambio mientras editabas. | Refrescar datos y reintentar. | No |
| `INV_STOCK_UNDERFLOW` | `inventory.stockUnderflow` | La operacion deja stock negativo. | Ajustar cantidad o validar movimientos previos. | No |

### 4.6 CRM

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `CRM_CONTACT_ALREADY_EXISTS` | `crm.contactExists` | Ya existe un contacto con esos datos. | Revisar email/telefono e intentar de nuevo. | No |
| `CRM_CONTACT_NOT_FOUND` | `crm.contactNotFound` | Contacto no encontrado. | Volver al listado de contactos. | No |
| `CRM_ORGANIZATION_ALREADY_EXISTS` | `crm.organizationExists` | Ya existe una organizacion con esos datos. | Ajustar nombre o datos unicos. | No |
| `CRM_ORGANIZATION_NOT_FOUND` | `crm.organizationNotFound` | Organizacion no encontrada. | Volver al listado de organizaciones. | No |
| `CRM_ORGANIZATION_IN_USE` | `crm.organizationInUse` | No se puede eliminar organizacion en uso. | Reasignar referencias antes de eliminar. | No |
| `CRM_OPPORTUNITY_NOT_FOUND` | `crm.opportunityNotFound` | Oportunidad no encontrada. | Volver al pipeline. | No |
| `CRM_OPPORTUNITY_STAGE_INVALID` | `crm.stageInvalid` | La etapa indicada no es valida. | Seleccionar etapa permitida. | No |
| `CRM_OPPORTUNITY_STAGE_TRANSITION_INVALID` | `crm.stageTransitionInvalid` | La transicion de etapa no esta permitida. | Seguir el flujo de etapas permitido. | No |
| `CRM_ACTIVITY_REFERENCE_INVALID` | `crm.activityReferenceInvalid` | La actividad referencia recursos invalidos. | Corregir referencia de contacto/org/oportunidad. | No |

### 4.7 HR

| Codigo | Clave i18n sugerida | Mensaje UX base | Accion usuario | Retry |
|---|---|---|---|---|
| `HR_EMPLOYEE_ALREADY_EXISTS` | `hr.employeeExists` | Ya existe un empleado con ese codigo. | Corregir codigo de empleado. | No |
| `HR_EMPLOYEE_NOT_FOUND` | `hr.employeeNotFound` | Empleado no encontrado. | Volver al listado de empleados. | No |
| `HR_EMPLOYEE_HIERARCHY_INVALID` | `hr.hierarchyInvalid` | Jerarquia de reporte invalida. | Corregir manager asignado. | No |
| `HR_EMPLOYEE_HIERARCHY_CYCLE` | `hr.hierarchyCycle` | La jerarquia crea un ciclo de reporte. | Seleccionar otro manager. | No |
| `HR_COMPENSATION_NOT_FOUND` | `hr.compensationNotFound` | Compensacion no encontrada para el empleado. | Crear/actualizar compensacion segun flujo. | No |
| `HR_COMPENSATION_INVALID` | `hr.compensationInvalid` | Datos de compensacion invalidos. | Corregir montos/periodicidad/fecha. | No |

## 5. Implementacion recomendada

1. Definir un mapper `error.code -> uxErrorDescriptor`.
2. Usar un fallback global para codigos desconocidos (`GEN_INTERNAL_ERROR`).
3. Incluir `traceId` en toast/modal de errores no manejados.
4. Mantener i18n por clave, no por texto literal del backend.

