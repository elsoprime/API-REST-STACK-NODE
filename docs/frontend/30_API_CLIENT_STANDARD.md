# Estandar del Cliente API Frontend

Version: 1.2.0
Estado: Activo
Ultima actualizacion: 2026-03-11

## 1. Proposito

Definir un estandar unico de cliente HTTP para todo el frontend: autenticacion, CSRF, contexto tenant, manejo de errores y trazabilidad.

## 2. Reglas obligatorias (MUST)

1. Toda llamada browser autenticada usa `credentials: include`.
2. Toda ruta tenant-scoped envia `X-Tenant-Id`.
3. Toda mutacion cookie-auth envia `X-CSRF-Token`.
4. Errores se normalizan al envelope global (`success=false`, `error`, `traceId`).
5. Solo un intento de refresh automatico por request.
6. `traceId` debe registrarse para soporte/observabilidad.

## 3. Clasificacion de rutas para headers

### 3.1 Tenant-scoped (requiere `X-Tenant-Id`)

- `/api/v1/audit`
- `/api/v1/tenant/settings*`
- `/api/v1/modules/*`
- `/api/v1/tenant/invitations`
- `/api/v1/tenant/invitations/revoke`
- `/api/v1/tenant/transfer-ownership`
- `/api/v1/tenant/subscription`
- `/api/v1/billing/checkout/session`

### 3.2 Excepciones tenant-bound sin `X-Tenant-Id`

- `/api/v1/tenant/switch` (tenant se define en body)
- `/api/v1/tenant/invitations/accept` (tenant se resuelve por token)

### 3.3 No tenant-scoped

- `/health`
- `/api/v1/auth/*`
- `/api/v1/tenant`
- `/api/v1/tenant/mine`
- `/api/v1/platform/settings`
- `/api/v1/billing/plans`

Nota:

- `/api/v1/billing/webhooks/provider` es endpoint `system-to-system` y no debe ser llamado desde cliente frontend.

## 4. Contratos de entrada y salida sugeridos

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  traceId: string;
};

type ApiErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  traceId: string;
};

type ApiClientError = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  traceId?: string;
  retryable: boolean;
};
```

## 5. Flujo de request recomendado

1. Resolver metodo, path y modo (`browser` o `headless`).
2. Inyectar `X-Tenant-Id` si la ruta es tenant-scoped y no esta en excepciones.
3. Inyectar `X-CSRF-Token` en mutaciones cookie-auth.
4. Enviar request.
5. Parsear envelope.
6. Si `401` en browser, intentar `POST /api/v1/auth/refresh/browser` solo una vez y reintentar request original.

## 6. Politica de retry

- Retry automatico permitido:
  - solo refresh browser ante `401` autenticado.
- Retry manual sugerido:
  - `GEN_RATE_LIMITED` despues de enfriamiento.
- Sin retry:
  - `403`, `404`, `409` y errores de validacion/dominio.

## 7. Pseudo-codigo de referencia

```ts
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isTenantScoped(path: string): boolean {
  return (
    path.startsWith('/api/v1/audit') ||
    path.startsWith('/api/v1/tenant/settings') ||
    path.startsWith('/api/v1/modules/') ||
    path === '/api/v1/tenant/invitations' ||
    path === '/api/v1/tenant/invitations/revoke' ||
    path === '/api/v1/tenant/transfer-ownership' ||
    path === '/api/v1/tenant/subscription' ||
    path === '/api/v1/billing/checkout/session'
  );
}

function isTenantHeaderException(path: string): boolean {
  return path === '/api/v1/tenant/switch' || path === '/api/v1/tenant/invitations/accept';
}

function readCsrfCookie(cookieName: string): string | undefined {
  const raw = document.cookie.split(';').map((v) => v.trim());
  const pair = raw.find((v) => v.startsWith(`${cookieName}=`));
  return pair ? decodeURIComponent(pair.split('=').slice(1).join('=')) : undefined;
}

async function request<T>(input: {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  tenantId?: string;
  browserMode: boolean;
  csrfCookieName: string;
  appUrl: string;
  allowRefreshRetry?: boolean;
}): Promise<ApiSuccess<T>> {
  const method = input.method ?? 'GET';
  const headers = new Headers(input.headers ?? {});

  if (isTenantScoped(input.path) && !isTenantHeaderException(input.path) && input.tenantId) {
    headers.set('X-Tenant-Id', input.tenantId);
  }

  if (input.browserMode && MUTATING.has(method)) {
    const csrf = readCsrfCookie(input.csrfCookieName);
    if (csrf) headers.set('X-CSRF-Token', csrf);
  }

  if (input.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${input.appUrl}${input.path}`, {
    method,
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
    credentials: input.browserMode ? 'include' : 'omit'
  });

  const payload = await response.json();

  if (response.ok) return payload as ApiSuccess<T>;

  const error: ApiClientError = {
    status: response.status,
    code: payload?.error?.code ?? 'GEN_INTERNAL_ERROR',
    message: payload?.error?.message ?? 'Unknown error',
    details: payload?.error?.details,
    traceId: payload?.traceId,
    retryable: false
  };

  if (
    input.browserMode &&
    response.status === 401 &&
    input.allowRefreshRetry !== false &&
    !input.path.startsWith('/api/v1/auth/refresh/browser')
  ) {
    await request({
      path: '/api/v1/auth/refresh/browser',
      method: 'POST',
      browserMode: true,
      csrfCookieName: input.csrfCookieName,
      appUrl: input.appUrl,
      allowRefreshRetry: false
    });

    return request({ ...input, allowRefreshRetry: false });
  }

  throw error;
}
```

## 8. Observabilidad y soporte

- Reportar `traceId`, `path`, `method`, `status`, `error.code`.
- No enviar tokens ni payload sensible al logger frontend.
- Mostrar `traceId` como referencia de soporte en errores no manejados.

## 9. Checklist de adopcion

- [ ] Existe una sola instancia de API client compartida.
- [ ] No hay `fetch/axios` directos fuera del cliente estandar.
- [ ] `X-Tenant-Id` y `X-CSRF-Token` se inyectan automaticamente.
- [ ] Manejo de refresh `401` implementado y probado.
- [ ] Normalizacion de errores y captura de `traceId` implementadas.
