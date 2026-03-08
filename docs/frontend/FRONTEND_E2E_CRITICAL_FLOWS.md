# Flujos E2E Criticos Frontend

Version: 1.0.0  
Estado: Activo  
Ultima actualizacion: 2026-03-08

## 1. Proposito

Definir la suite E2E minima para proteger flujos de negocio criticos y evitar regresiones en integracion frontend-backend.

## 2. Framework sugerido

- Playwright (recomendado)

## 3. Datos de prueba minimos

- Usuario A: verificado, con acceso tenant owner (tenant T1)
- Usuario B: miembro tenant (tenant T1)
- Usuario C: sin tenants
- Tenant T2 para validar aislamiento
- Datos seed para Inventory, CRM y HR en T1

## 4. Flujos criticos obligatorios

### E2E-01 Login browser exitoso

1. Abrir `/login`.
2. Enviar credenciales validas.
3. Verificar redireccion a shell autenticado.
4. Verificar carga de tenants (`/api/v1/tenant/mine`).

Criterio de aceptacion:

- Sesion inicializada y UI en estado autenticado.

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

1. Con usuario con multiples tenants, elegir tenant distinto.
2. Ejecutar switch.
3. Verificar invalidacion cache tenant anterior.
4. Verificar recarga de settings efectivos y modulos.

Criterio de aceptacion:

- No hay mezcla de datos entre tenants.

### E2E-05 Guardas por permisos

1. Ingresar con usuario sin permiso de accion.
2. Intentar acceder ruta o accion protegida.
3. Verificar estado UX "sin acceso".

Criterio de aceptacion:

- UI no rompe y no intenta loops de reintento.

### E2E-06 Inventory CRUD + conflicto

1. Crear categoria e item.
2. Editar item.
3. Ejecutar movimiento de stock concurrente simulado.
4. Verificar manejo UX de `INV_STOCK_CONFLICT`.

Criterio de aceptacion:

- Usuario recibe guia clara y estado consistente.

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

## 5. Suite recomendada por pipeline

### 5.1 Pull Request

- E2E-01, E2E-03, E2E-04, E2E-05

### 5.2 Pre-release / staging

- Todos los casos E2E-01 a E2E-10

## 6. Evidencia requerida por corrida

- Video o trace por caso fallido
- Captura de `traceId` cuando aplique
- Reporte con resumen de casos pasados/fallidos

## 7. Criterio de bloqueo de release

Bloquear salida si falla cualquiera de:

- Login y refresh de sesion
- Tenant switch y aislamiento
- Guardas de permisos
- Flujo critico Inventory
