# Estandar del Cliente API Frontend

Version: 1.0.0  
Estado: Activo  
Ultima actualizacion: 2026-03-08

## 1. Proposito

Definir un unico estandar de cliente HTTP para todo el frontend: autenticacion, CSRF, contexto tenant, manejo de errores y trazabilidad.

## 2. Reglas obligatorias (MUST)

1. Toda llamada browser debe usar `credentials: include`.
2. Toda ruta tenant-scoped debe enviar `X-Tenant-Id`.
3. Toda mutacion cookie-auth debe enviar `X-CSRF-Token`.
4. Errores deben normalizarse al envelope global (`success=false`, `error`, `traceId`).
5. Solo un intento de refresh automatico por request.
6. `traceId` debe exponerse al sistema de observabilidad frontend.

## 3. Clasificacion de rutas para headers

### 3.1 Tenant-scoped

- `/api/v1/audit`
- `/api/v1/tenant/settings*`
- `/api/v1/modules/*`
- `/api/v1/tenant/invitations` y `/api/v1/tenant/invitations/revoke`
- `/api/v1/tenant/transfer-ownership`

### 3.2 No tenant-scoped

- `/health`
- `/api/v1/auth/*`
- `/api/v1/tenant`
- `/api/v1/tenant/mine`
- `/api/v1/tenant/switch`
- `/api/v1/tenant/invitations/accept`
- `/api/v1/platform/settings`

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

1. Resolver metodo HTTP y ruta.
2. Inyectar `X-Tenant-Id` si ruta es tenant-scoped.
3. Inyectar `X-CSRF-Token` si metodo mutable y modo browser cookie-auth.
4. Enviar request con `credentials: include`.
5. Parsear envelope:
   - exito: retornar `data`
   - error: normalizar y lanzar `ApiClientError`
6. Si `401` autenticado browser:
   - intentar `POST /api/v1/auth/refresh/browser` una vez
   - reenviar request original una sola vez

## 6. Politica de retry

- Retry automatico permitido:
  - Solo para refresh browser ante 401 autenticado
- Retry manual sugerido:
  - `GEN_RATE_LIMITED` despues de enfriamiento
- Sin retry:
  - `403`, `404`, `409`, codigos de validacion de dominio

## 7. Pseudo-codigo de referencia

```ts
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isTenantScoped(path: string): boolean {
  return path.startsWith('/api/v1/audit')
    || path.startsWith('/api/v1/tenant/settings')
    || path.startsWith('/api/v1/modules/')
    || path === '/api/v1/tenant/invitations'
    || path === '/api/v1/tenant/invitations/revoke'
    || path === '/api/v1/tenant/transfer-ownership';
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

  if (isTenantScoped(input.path) && input.tenantId) {
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
    credentials: 'include'
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

    return request({
      ...input,
      allowRefreshRetry: false
    });
  }

  throw error;
}
```

## 8. Observabilidad y soporte

- Reportar `traceId`, `path`, `method`, `status`, `error.code`.
- Nunca enviar tokens ni payloads sensibles al logger frontend.
- En errores de usuario final, mostrar referencia con `traceId`.

## 9. Checklist de adopcion

- [ ] Existe una sola instancia de cliente API compartida.
- [ ] No hay llamadas `fetch/axios` directas fuera del cliente estandar.
- [ ] `X-Tenant-Id` y `X-CSRF-Token` se inyectan automaticamente.
- [ ] Manejo de refresh 401 implementado y testeado.
- [ ] Normalizacion de errores y `traceId` implementada.
