# Definition of Done Frontend

Version: 1.4.0
Estado: Activo
Ultima actualizacion: 2026-03-21

## 1. Proposito

Definir el criterio minimo de calidad para cerrar historias, pantallas y modulos frontend con consistencia contractual y operativa.

## 2. DoD global por historia

- [ ] La pantalla usa solo endpoints existentes en `openapi/`.
- [ ] Requests tenant-scoped envian `X-Tenant-Id`.
- [ ] Mutaciones cookie-auth envian `X-CSRF-Token`.
- [ ] Se maneja envelope de error (`error.code`, `traceId`).
- [ ] Estados loading/empty/error/success implementados.
- [ ] Guardas por permiso/modulo aplicadas en UI.
- [ ] Sin tokens en localStorage/sessionStorage.
- [ ] Test unitario de comportamiento principal.
- [ ] Test de integracion de flujo principal.
- [ ] Documentacion frontend actualizada (si cambia contrato o flujo).

## 3. DoD por pantalla

Usar esta plantilla en PR:

```text
Pantalla:
Ruta UI:
Endpoint(s):
Permiso(s):

Checklist:
[ ] Carga inicial correcta
[ ] Validaciones de formulario
[ ] Manejo de errores por codigo
[ ] Acciones bloqueadas sin permiso
[ ] Reintento/refresh cuando aplica
[ ] Telemetria y traceId
```

## 4. DoD por modulo

### 4.1 Inventory

- [ ] CRUD categorias completo.
- [ ] CRUD items completo.
- [ ] Flujo de stock movements completo.
- [ ] Manejo `INV_STOCK_CONFLICT` validado.
- [ ] Alertas low-stock visibles y consistentes.

### 4.2 CRM

- [ ] Contactos CRUD.
- [ ] Organizaciones CRUD.
- [ ] Oportunidades CRUD + cambio de etapa.
- [ ] Actividades create/list.
- [ ] Counters sincronizados tras mutaciones.

### 4.3 HR

- [ ] Empleados CRUD.
- [ ] Compensacion get/update.
- [ ] Ocultamiento de datos sensibles por permisos.
- [ ] Manejo de jerarquia invalida/ciclica.

### 4.4 Billing y Provisioning

- [ ] Catalogo de planes (`GET /api/v1/billing/plans`) integrado.
- [ ] Checkout session (`POST /api/v1/billing/checkout/session`) con estado UX claro.
- [ ] Suscripcion tenant (`PATCH/DELETE /api/v1/tenant/subscription`) integrada.
- [ ] Runtime efectivo refetch e invalidacion de cache tras cambios de plan.
- [ ] UI robusta ante runtime incompleto o nulo (sin crashes de render).

### 4.5 Expenses

- [ ] Workspace de Expenses visible solo si modulo/plan lo habilitan.
- [ ] `settings` en modo solo lectura cuando falta `tenant:expenses:settings:update`.
- [ ] Ciclo de vida de categorias (activar/desactivar) funcional y consistente con backend.
- [ ] Flujos `requests` y `settings` cubiertos por E2E critico.

## 5. DoD de seguridad y compliance

- [ ] No se exponen datos sensibles en logs frontend.
- [ ] Se respeta aislamiento tenant en cache y vistas.
- [ ] Se limpia estado al logout y al refresh fallido.
- [ ] Se validan flujos de acceso denegado (`403`) sin loops.

## 6. DoD de testing E2E

- [ ] Caso E2E critico agregado/actualizado cuando cambia flujo core.
- [ ] Evidencia de corrida local o CI adjunta.
- [ ] Casos regresivos previos siguen en verde.

## 7. DoD documental

- [ ] `10_IMPLEMENTATION_GUIDE_V2.md` actualizado si cambia flujo.
- [ ] `20_ACCESS_MATRIX.md` actualizado si cambia acceso/permisos.
- [ ] `50_ERROR_CATALOG.md` actualizado si aparece nuevo `error.code`.
- [ ] `80_BACKEND_DEPENDENCIES.md` actualizado si se abre/cierra bloqueo.
- [ ] `95_DOCS_DEPRECATION_MATRIX.md` actualizado si cambia estado documental.
- [ ] Documentacion de `expenses` en modo espejo backend/frontend al mismo corte de fecha y version.

## 8. Criterio de rechazo de PR

Rechazar PR frontend si:

- Usa endpoint no documentado en OpenAPI.
- Omite `X-Tenant-Id` donde es obligatorio.
- Omite CSRF en mutaciones browser cookie-auth.
- No maneja errores de dominio relevantes.
- No incluye evidencia minima de testing.


## 9. DoD Scope Split (2026-03-13)

- [x] Cliente API separado por scope (	enantApiRequest y platformApiRequest).
- [x] Guardas de mezcla de contexto (TENANT_SCOPE_MISMATCH) en cliente API.
- [x] Servicios tenant migrados a cliente tenant-scoped.
- [x] Servicios platform migrados a cliente platform-scoped.
- [x] Tests de scope agregados y en verde.
- [x] Evidencia de smoke en vivo documentada (docs/cierres/ETAPA_FE_SCOPE_SPLIT_QA_2026-03-13.md).


## 10. DoD Billing UX Activation (2026-03-13)

- [x] Flujo guiado visible en `/app/settings/billing` (plan -> checkout -> activacion).
- [x] Accion de activacion bloqueada sin `checkoutSessionId` valido del plan seleccionado.
- [x] Verificacion explicita de activacion via refetch `tenant/mine` + `tenant/settings/effective`.
- [x] Mensajeria UX separa estado intermedio de checkout y estado final activado.
- [x] Sin llamadas UI a `POST /api/v1/billing/webhooks/provider`.
- [x] Evidencia QA registrada en `docs/cierres/ETAPA_FE_SCOPE_SPLIT_QA_2026-03-13.md`.

## 11. DoD ciclo suscripcion (activar/cancelar/reactivar) - 2026-03-13

- [x] Cancelar suscripcion invalida checkout previo en UI.
- [x] Reactivacion requiere checkout nuevo (no reuse de `checkoutSessionId`).
- [x] Verificacion de reactivacion usa runtime efectivo para confirmar estado final.
- [x] Dashboard bloquea acciones de modulos cuando no estan activos por runtime/suscripcion.
- [x] Sidebar no expone audit como siempre activo sin plan.
- [x] E2E del ciclo completo en verde (`tests/e2e/billing-cycle.spec.ts`).
