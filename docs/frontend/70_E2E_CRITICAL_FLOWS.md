# Flujos E2E Criticos Frontend

Version: 1.7.0
Estado: Activo
Ultima actualizacion: 2026-03-21

## 1. Proposito

Definir la suite E2E minima para proteger flujos de negocio criticos y evitar regresiones en integracion frontend-backend.

## 2. Framework sugerido

- Playwright (recomendado)

## 3. Datos de prueba minimos

- Usuario A: verificado, con acceso tenant owner (tenant T1)
- Usuario B: miembro tenant admin (tenant T1)
- Usuario C: miembro tenant sin permisos de memberships update/delete (tenant T1)
- Usuario D: sin tenants
- Tenant T2 para validar aislamiento
- Datos seed para Inventory, CRM y HR en T1
- Catalogo seed de billing plans (`starter`, `growth`, `enterprise`)
- Payloads de webhook billing (paid/failed/canceled) + `X-Billing-Signature` valida y `X-Billing-Timestamp` dentro de tolerancia para entorno dev
- Casos negativos de webhook: firma invalida y timestamp vencido para validacion backend/system path

## 4. Flujos criticos obligatorios

### E2E-01 Login browser exitoso

1. Abrir `/login`.
2. Enviar credenciales validas.
3. Verificar carga de tenants (`/api/v1/tenant/mine`).
4. Verificar redireccion a shell autenticado o selector tenant segun cantidad/contexto activo.

Criterio de aceptacion:

- Sesion inicializada y UI en estado autenticado sin asumir un unico tenant.

### E2E-02 Sesion expirada + refresh

1. Simular request protegido que responde 401.
2. Verificar llamada a `POST /api/v1/auth/refresh/browser`.
3. Verificar reintento exitoso de request original.

Criterio de aceptacion:

- Usuario no es expulsado si refresh es exitoso.

### E2E-03 Refresh fallido

1. Simular 401 + refresh fallido.
2. Verificar limpieza de estado local.
3. Verificar redireccion a `/login`.

Criterio de aceptacion:

- No quedan datos sensibles en UI tras logout forzado.

### E2E-04 Tenant switch

1. Validar bootstrap de `/app` cuando hay exactamente un tenant sin contexto activo.
2. Con usuario con multiples tenants, elegir tenant distinto.
3. Ejecutar switch.
4. Verificar invalidacion cache tenant anterior.
5. Verificar recarga del shell con tenant activo correcto.

Criterio de aceptacion:

- No hay mezcla de datos entre tenants.

### E2E-04B Onboarding tenant

1. Ingresar con usuario autenticado sin tenant activo disponible.
2. Abrir `/app/tenants/create`.
3. Crear tenant.
4. Ejecutar `tenant/switch` inmediato.
5. Verificar regreso a `/app` con contexto activo correcto.

Criterio de aceptacion:

- El primer tenant queda activo sin refetch redundante ni callejon sin salida.

### E2E-04C Tenant settings + runtime efectivo

1. Abrir `/app/settings/tenant` con sesion browser valida.
2. Verificar carga de `GET /api/v1/tenant/settings`.
3. Verificar carga de `GET /api/v1/tenant/settings/effective`.
4. Editar singleton y ejecutar `PATCH /api/v1/tenant/settings`.
5. Verificar refetch de runtime efectivo y confirmacion UX.
6. Simular `403 TENANT_SUBSCRIPTION_PAYMENT_REQUIRED` en `tenant/settings/effective` y verificar CTA a `/app/settings/billing` sin retry loop.

Criterio de aceptacion:

- El singleton se actualiza sin perder contexto tenant y el runtime queda consistente en UI.
- Ante `TENANT_SUBSCRIPTION_PAYMENT_REQUIRED`, la UI debe guiar a Billing con CTA explicito.

Referencia operativa local: `docs/operaciones/BILLING_LOCAL_DEMO_RUNBOOK.md`

### E2E-04D Billing provisioning + runtime efectivo

1. Abrir `/app/settings/billing`.
2. Cargar `GET /api/v1/billing/plans`.
3. Crear checkout (`POST /api/v1/billing/checkout/session`) para plan objetivo.
4. Simular procesamiento webhook paid (backend/system path) con firma y timestamp validos.
5. Verificar refetch de `GET /api/v1/tenant/settings/effective`.

Criterio de aceptacion:

- El flujo termina en estado activated y el runtime refleja plan/modulos/features esperados.

### E2E-04E Cancelacion de suscripcion

1. Con tenant con plan activo, ejecutar `DELETE /api/v1/tenant/subscription`.
2. Verificar refetch de runtime efectivo.
3. Verificar bloqueo de modulos dependientes de plan.

Criterio de aceptacion:

- El tenant queda sin plan activo y la UI no muestra modulos no habilitados.

### E2E-05 Guardas por permisos

1. Ingresar con usuario sin permiso de accion.
2. Intentar acceder ruta o accion protegida.
3. Verificar estado UX "sin acceso".

Criterio de aceptacion:

- UI no rompe y no intenta loops de reintento.

### E2E-05B Members team list/update/remove

1. Abrir `/app/members?tab=team` con usuario owner o admin.
2. Verificar `GET /api/v1/tenant/memberships` y render de tabla.
3. Filtrar por `search`, `roleKey` y `status`.
4. Ejecutar `PATCH /api/v1/tenant/memberships/{membershipId}` sobre un miembro no owner.
5. Ejecutar `DELETE /api/v1/tenant/memberships/{membershipId}` sobre un miembro no owner.
6. Intentar mutar o remover owner efectivo y verificar mensaje basado en `TENANT_MEMBERSHIP_OWNER_PROTECTED`.

Criterio de aceptacion:

- La tabla refleja datos reales tenant-scoped.
- Las mutaciones invalidan cache y refrescan el listado.
- El owner efectivo nunca puede alterarse desde este flujo.

### E2E-05C Platform security settings

1. Abrir `/app/settings/security` con usuario platform-scoped autorizado.
2. Verificar carga de `GET /api/v1/platform/settings`.
3. Editar `requireTwoFactorForPrivilegedUsers`, `passwordPolicy`, `sessionPolicy` o `riskControls`.
4. Guardar con `PATCH /api/v1/platform/settings`.
5. Verificar mensaje de confirmacion y refetch del singleton.

Criterio de aceptacion:

- La pantalla opera sobre `data.security` sin endpoint alternativo.
- El formulario conserva estado consistente tras refetch.

### E2E-05D Platform audit list

1. Abrir la vista de auditoria platform-scoped con usuario autorizado.
2. Verificar carga de `GET /api/v1/platform/audit`.
3. Aplicar filtros basicos por accion, actor y rango de fechas.
4. Verificar paginacion y estado vacio.
5. Validar `401/403` como estado de acceso restringido sin fallback tenant.

Criterio de aceptacion:

- La vista consume exclusivamente contrato platform-scoped.
- Los filtros quedan reproducibles por URL si la pantalla adopta persistencia en query params.
- La UX diferencia falta de autenticacion, falta de permisos y ausencia de resultados.

### E2E-05E Expenses settings permissions + category lifecycle

1. Abrir `/app/expenses?tab=settings` con usuario `tenant:admin`.
2. Verificar carga de `GET /api/v1/modules/expenses/settings` y `GET /api/v1/modules/expenses/categories`.
3. Ejecutar `PUT /api/v1/modules/expenses/settings` y confirmar feedback + refetch.
4. Ejecutar `PATCH /api/v1/modules/expenses/categories/{categoryId}` para `isActive` y confirmar estado activo/inactivo.
5. Repetir flujo con usuario sin permiso update y verificar modo solo lectura sin mutaciones.

Criterio de aceptacion:

- UI solo permite mutaciones a roles con permiso update.
- La vista muestra estado solo lectura cuando falta permiso.
- El ciclo de vida de categoria (activar/desactivar) queda reflejado en tabla y sin desalineacion con backend.

### E2E-06 Inventory CRUD + conflicto

1. Crear categoria e item.
2. Editar item.
3. Ejecutar movimiento de stock concurrente simulado.
4. Verificar manejo UX de `INV_STOCK_CONFLICT`.

Criterio de aceptacion:

- Usuario recibe guia clara y estado consistente.

Pendientes de cobertura explicita al retomar hardening Inventory:

- validar que alertas de formulario en `warehouses`, `lots`, `stock-movements` y `stocktakes` se rendericen dentro del modal, no detras de la tabla
- validar selector de filas por pagina y reset a pagina 1 al cambiar busqueda o filtros
- validar comportamiento esperado de busqueda textual en listados donde hoy pueda seguir siendo local a la pagina cargada

### E2E-07 CRM pipeline

1. Crear oportunidad.
2. Cambiar etapa a transicion valida.
3. Intentar transicion invalida simulada.
4. Verificar mensaje y estado final consistente.

Criterio de aceptacion:

- El pipeline no queda en estado corrupto en UI.

### E2E-08 HR compensacion por permisos

1. Usuario con permiso de lectura empleados pero sin compensacion.
2. Abrir detalle empleado.
3. Verificar ocultamiento de seccion compensacion.

Criterio de aceptacion:

- Datos sensibles no visibles sin permiso.

### E2E-09 Auditoria filtros

1. Abrir modulo auditoria.
2. Aplicar filtros y paginacion.
3. Verificar persistencia de filtros en URL.

Criterio de aceptacion:

- Filtros reproducibles por URL y resultados consistentes.

### E2E-10 Logout y limpieza

1. Ejecutar logout.
2. Verificar redireccion a login.
3. Verificar cache vacia y pantallas protegidas inaccesibles.

Criterio de aceptacion:

- No hay acceso residual post logout.

### E2E-11 Forgot + reset password

1. Abrir `/auth/forgot-password` y enviar email.
2. Verificar respuesta aceptada generica (`202`) sin enumeracion de cuenta.
3. Completar `/auth/reset-password` con token valido y nueva contrasena.
4. Verificar exito y continuidad de flujo de login.

Criterio de aceptacion:

- Flujo de recuperacion funcional sin filtrar estado interno de cuenta.

### E2E-12 Change password y revocacion de otras sesiones

1. Iniciar dos sesiones del mismo usuario (navegadores/perfiles separados).
2. Desde sesion A ejecutar `/api/v1/auth/change-password`.
3. Verificar que sesion B queda revocada y exige reautenticacion.
4. Verificar que sesion A permanece operativa.

Criterio de aceptacion:

- Seguridad de sesiones consistente tras cambio de contrasena.

## 5. Suite recomendada por pipeline

### 5.1 Pull Request

- E2E-01, E2E-03, E2E-04, E2E-04D, E2E-05, E2E-05B, E2E-05C, E2E-05E, E2E-11

### 5.2 Pre-release / staging

- Todos los casos E2E-01 a E2E-12 + E2E-04D/E2E-04E + E2E-05B/E2E-05C/E2E-05E

## 6. Evidencia requerida por corrida

- Video o trace por caso fallido
- Captura de `traceId` cuando aplique
- Reporte con resumen de casos pasados/fallidos

## 7. Criterio de bloqueo de release

Bloquear salida si falla cualquiera de:

- Login y refresh de sesion
- Tenant switch y aislamiento
- Guardas de permisos
- Members team list/update/remove
- Platform security settings
- Flujo critico Inventory
- Recuperacion y cambio de contrasena

## 8. Cobertura local vigente

Casos implementados y validados localmente:

- E2E-01 Login browser exitoso
- E2E-02 Restauracion/refresh browser exitoso al entrar a `/app`
- E2E-03 Refresh browser fallido con redireccion a `/login?expired=1`
- E2E-04 Tenant auto-switch con unico tenant y tenant switch manual con multiples tenants
- E2E-04B Onboarding tenant con `create + switch`
- E2E-04C Tenant settings + runtime efectivo
- E2E-04D Billing provisioning y runtime efectivo
- E2E-04E Cancelacion de suscripcion y bloqueo de modulos dependientes de plan
- E2E-05 Guardas por permisos en workspace members sin acceso
- E2E-05B Members team list/update/remove
- E2E-05C Platform security settings
- E2E-05E Expenses settings permissions + category lifecycle
- E2E-06 Inventory CRUD/listados operativos
- E2E-07 CRM pipeline/listados operativos
- E2E-08 HR empleados y permisos base
- E2E-09 Auditoria filtros y navegacion
- E2E-10 Logout y limpieza con bloqueo posterior de `/app`
- E2E-11 Forgot + reset password
- E2E-12 Change password y revocacion de sesiones

Pendiente de cobertura local explicita:

- E2E-05D Platform audit list, en espera de contrato/runtime `GET /api/v1/platform/audit`.

Archivos actuales:

- `tests/e2e/login.spec.ts`
- `tests/e2e/tenant.spec.ts`
- `tests/e2e/tenant-settings.spec.ts`
- `tests/e2e/billing-cycle.spec.ts`
- `tests/e2e/audit.spec.ts`
- `tests/e2e/modules.spec.ts`
- `tests/e2e/security-2fa.spec.ts`
- `tests/e2e/auth-recovery.spec.ts`
- `tests/e2e/members.spec.ts`
- `tests/e2e/platform-security.spec.ts`
- `tests/e2e/expenses-settings-critical.spec.ts`
- `tests/e2e/expenses-settings-permissions.spec.ts`
- `tests/e2e/guards.spec.ts`
