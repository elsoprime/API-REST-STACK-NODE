# Politica de Estado y Cache Frontend

Version: 1.1.0  
Estado: Activo  
Ultima actualizacion: 2026-03-09

## 1. Proposito

Definir como gestionar estado, cache e invalidaciones en frontend para evitar fugas cross-tenant y estados inconsistentes.

## 2. Principios

- Separar estado de sesion de estado tenant-scoped.
- Toda cache tenant-scoped debe estar indexada por `tenantId`.
- En `tenant switch`, invalidar completamente cache del tenant previo.
- No persistir tokens en storage en modo browser.
- Backend sigue siendo autoridad final de permisos y datos.

## 3. Estructura de estado recomendada

```ts
type AppState = {
  session: {
    isAuthenticated: boolean;
    authMode: 'browser' | 'headless';
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string | null;
      status: 'active' | 'pending_verification';
      isEmailVerified: boolean;
    } | null;
    sessionId: string | null;
  };
  tenant: {
    activeTenantId: string | null;
    activeMembership: {
      id: string;
      roleKey: string;
      status: string;
    } | null;
    effectiveRuntime: {
      planId: string | null;
      activeModuleKeys: string[];
      enabledModuleKeys: string[];
      featureFlagKeys: string[];
    } | null;
  };
  ui: {
    locale: string;
    theme: 'light' | 'dark' | 'system';
    lastTraceId: string | null;
  };
};
```

## 4. Convencion de cache (query keys)

Formato:

- `platform:<resource>`
- `tenant:<tenantId>:<resource>`

Ejemplos:

- `platform:settings`
- `tenant:<id>:settings`
- `tenant:<id>:settings:effective`
- `tenant:<id>:audit:list:<filtersHash>`
- `tenant:<id>:inventory:items:<filtersHash>`
- `tenant:<id>:crm:counters`
- `tenant:<id>:hr:employees:<filtersHash>`

Regla:

- Nunca usar keys tenant-scoped sin `tenantId`.

Implementacion vigente:

- `src/lib/query/query-keys.ts`
  - `["platform", "settings"]`
  - `["platform", "tenant", "mine"]`
  - `["tenant", tenantId, "settings"]`
  - `["tenant", tenantId, "settings", "effective"]`
- `src/lib/query/tenant-cache.ts`
  - limpieza tenant-scoped del tenant previo en switch
  - invalidacion central de `settings` y `settings:effective` tras update

## 5. Matriz de invalidacion

| Evento | Estado afectado | Cache a invalidar | Accion adicional |
|---|---|---|---|
| Login browser exito | `session`, `tenant` | Todo cache previo de usuario anonimo | Cargar `tenant/mine` |
| Refresh browser exitoso | `session` | Ninguna por defecto | Reintentar request original una vez |
| Refresh browser fallido | `session`, `tenant` | Todo cache de usuario | Redirect login |
| Logout / logout-all | `session`, `tenant`, `ui.lastTraceId` | Todo cache | Volver a login |
| Tenant switch exito | `tenant.activeTenantId`, `tenant.activeMembership`, `tenant.effectiveRuntime` | Todo `tenant:<oldTenantId>:*` | Cargar contexto del nuevo tenant y reconstruir runtime efectivo |
| Update tenant settings | `tenant.effectiveRuntime` | `tenant:<id>:settings`, `tenant:<id>:settings:effective` | Refetch despues de guardar y resincronizar shell/runtime |
| Update platform settings | Ningun tenant local inmediato (depende de UI) | `platform:settings`, `tenant:<id>:settings:effective` | Refetch runtime efectivo visible |
| Mutacion inventory | Estado de modulo inventory | Keys inventory del tenant activo | Mantener consistencia de stock |
| Mutacion CRM | Estado de modulo crm | Keys CRM del tenant activo + counters | Refetch counters |
| Mutacion HR | Estado de modulo hr | Keys HR del tenant activo | Refetch entidad afectada |

## 6. Politica de persistencia en storage

Permitido en `localStorage` o `sessionStorage`:

- Preferencias UI (`theme`, `locale`)
- Ultimo `tenantId` seleccionado (opcional, validar contra backend al boot)

No permitido:

- access token
- refresh token
- valores CSRF permanentes
- snapshots sensibles de HR/compensacion

## 7. Politica de optimistic updates

Permitido:

- CRM no critico (ej. nombre de contacto) con rollback claro
- Inventory solo donde no afecte stock concurrido

No recomendado:

- Ajustes de stock sin confirmacion backend
- Transferencias de ownership
- Cambios de compensacion HR

Regla:

- Ante `INV_STOCK_CONFLICT` o conflicto de dominio, revertir estado optimista y mostrar guia de resolucion.

## 8. Seguridad de estado

- Limpiar memoria de estado al detectar `AUTH_UNAUTHENTICATED` no recuperable.
- En cambio de usuario/sesion, destruir stores tenant-scoped previos.
- No registrar en logs frontend payloads sensibles de HR o datos de seguridad.

## 9. Checklist de cumplimiento

- [ ] Todas las query keys tenant incluyen `tenantId`.
- [ ] Existe rutina central para invalidar cache en `tenant switch`.
- [ ] Logout limpia estado global y cache completa.
- [ ] No se persisten tokens en storage.
- [ ] Se maneja rollback en conflictos de mutacion.
