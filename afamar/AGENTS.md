# AFAMAR - Mármoles & Granitos

## Stack
- **Backend:** Python 3.14+, FastAPI, SQLAlchemy, SQLite
- **Frontend:** React 18, React Router 6, Axios, Recharts, Lucide React

## Estructura del proyecto
```
afamar/
├── AGENTS.md
├── backend/
│   ├── .env                          # DATABASE_URL=sqlite:///./afamar.db
│   ├── requirements.txt
│   └── app/
│       ├── main.py                   # FastAPI app, CORS abierto, routers
│       ├── config.py                 # Settings (pydantic-settings)
│       ├── database.py               # SQLite, check_same_thread=False
│       ├── models/                   # SQLAlchemy models
│       │   ├── cliente.py            # Cliente (nombre, tel, email, dir, obs)
│       │   ├── presupuesto.py        # Presupuesto (ahora idéntico a OrdenTrabajo) + PresupuestoItem + PresupuestoAdicional
│       │   ├── presupuesto_online.py # PresupuestoOnline (tabla 11 filas + especiales + conversión)
│       │   ├── orden_trabajo.py      # OrdenTrabajo (dolar_dia, USD, firma, croquis, pileta, estados)
│       │   ├── medicion.py           # Medicion (fotos base64, croquis JSON)
│       │   ├── material.py           # Material (precio_m2 ARS, precio_m2_usd, moneda, proveedor)
│       │   ├── price_history.py      # Historial de precios por material
│       │   ├── stock_pileta.py       # StockPileta + MovimientoPileta
│       │   └── configuracion.py      # Config key-value
│       ├── schemas/                  # Pydantic
│       │   ├── presupuesto.py        # Incluye FabricacionDetalle, +30 campos nuevos
│       │   └── presupuesto_online.py # Schema para presupuestos en línea
│       ├── routers/
│       │   ├── dashboard.py          # 7 métricas: activas, total, ingresos, etc.
│       │   ├── clientes.py           # CRUD + búsqueda + ficha con historial
│       │   ├── presupuestos.py       # CRUD + convertir → orden (copia COMPLETA) + next-numero + auto-excluye CONVERTIDO A OT + WhatsApp/Email
│       │   ├── presupuestos_online.py # CRUD independiente
│       │   ├── ordenes_trabajo.py    # CRUD + next-numero + stock pileta + saldo_pagado
│       │   ├── materiales.py         # CRUD + price_history
│       │   ├── stock_piletas.py      # CRUD + movimientos
│       │   ├── mediciones.py         # CRUD mediciones
│       │   ├── reportes.py
│       │   └── configuracion.py      # Incluye upload-logo (multipart)
│       ├── services/
│       │   ├── pdf_generator.py      # ReportLab PDFs
│       │   ├── whatsapp_service.py
│       │   └── email_service.py      # SMTP
│       └── utils/
│           └── numeracion.py         # P-000001, A-000001
└── frontend/
    ├── package.json
    └── src/
        ├── index.js & index.css
        ├── App.js                    # React Router con Layout anidado
        ├── services/api.js           # Axios → localhost:8000/api
        ├── utils/formatters.js       # Moneda, fecha, badges, constantes
        └── components/
            ├── Layout.js             # Sidebar acordeón (fondo blanco, botones rojos, auto-ocultable)
            ├── common/               # Modal, Loading, ConfirmDialog
            ├── dashboard/Dashboard.js # Header rojo "afamar" + grilla 7 tarjetas + PRESUPUESTOS EN LÍNEA vertical
            ├── clientes/ClientesList.js & ClienteForm.js
            ├── presupuestos/
            │   ├── PresupuestosList.js     # Lista: Presupuesto Local / Realizados, convertir, WhatsApp, Email
            │   ├── PresupuestoForm.js      # Idéntico a OrdenForm (croquis, firma, pileta, dolar_dia, USD)
            │   ├── PresupuestosOnlineList.js
            │   └── PresupuestoOnlineForm.js # Tabla 11 filas + 7 especiales + conversión + WhatsApp export
            ├── ordenes/OrdenesList.js & OrdenForm.js
            ├── materiales/MaterialesList.js & MaterialForm.js
            ├── stock/StockPiletas.js
            ├── reportes/Reportes.js
            └── configuracion/Configuracion.js
```

## Estado actual
- Backend y frontend funcionales, conectados.
- Numeración automática: Presupuestos `P-000001`, Órdenes `A-000001`.
- Materiales con `precio_m2` (ARS) y `precio_m2_usd` (USD). Historial de precios automático.
- Los presupuestos usan el mismo formulario que las órdenes (idéntico).

### Flujo de trabajo
```
PRESUPUESTO LOCAL (P-000xxx)          PRESUPUESTO EN LÍNEA (independiente)
  │ PENDIENTE                                │
  │ ENVIADO                                  │
  │ APROBADO ──→ CONVERTIR A OT              │
  │ RECHAZADO                                │
  ▼                                          ▼
CONVERTIDO A OT → ORDEN DE TRABAJO (A-000xxx)
                    │ EN MEDICIÓN
                    │ EN EL TALLER
                    │ ENTREGADO
                    │ FINALIZADO (confirmación de pago)
                    ▼
              TRABAJOS TERMINADOS (pendiente)
```

### Estados Presupuesto Local
- `PENDIENTE` → default al crear
- `ENVIADO` → enviado al cliente
- `APROBADO` → listo para convertir
- `RECHAZADO` → descartado
- `CONVERTIDO A OT` → ya es orden de trabajo
- **Al convertir**: guarda automáticamente, cambia estado a CONVERTIDO A OT, crea Orden copiando TODOS los campos
- **No se elimina** el presupuesto al convertir
- **No se puede convertir dos veces** (bloqueo por duplicado)
- Vinculación bidireccional: presupuesto → orden_trabajo_numero, orden → presupuesto_numero

### Estados Orden de Trabajo
- `EN MEDICIÓN` → `EN EL TALLER` → `ENTREGADO` → `FINALIZADO` (vía confirmación de pago)
- Bloqueo de edición en EN EL TALLER / ENTREGADO / FINALIZADO
- Stock de pileta se descuenta al pasar a EN EL TALLER

### PRESUPUESTOS LOCAL (idéntico a OrdenForm)
- Mismo layout: 4 paneles (Detalle Fabricación, Pileta, Presupuesto, Aprobación)
- CroquisEditor con 9 herramientas + zoom + deshacer/rehacer
- FirmaCanvas digital
- Panel PRESUPUESTO con dos columnas ARS/USD + DÓLAR DEL DÍA
- Cálculos automáticos: subtotal_usd = subtotal / dolar_dia, traslado/sena bidireccionales
- `dolar_dia` se congela por presupuesto (no usa tipo_cambio global)
- `fecha_entrega` visible como campo date
- Botón CONVERTIR A ORDEN en el header (rojo, guarda + convierte)
- Menú tres puntos con opción Guardar

### PRESUPUESTOS EN LÍNEA (módulo independiente)
- Tabla con 11 filas de producción (LONGITUD) + 7 filas especiales (ZÓCALOS, APERTURA PILETA, MENSULAS, etc.)
- Columnas: Detalle / Largo / Ancho / M²-U / Cant. / Precio Unit. / Subtotal
- Especiales usan "U" (unidad) en vez de M²
- TOTAL GRAL + CONVERSIÓN (factor multiplicador, fondo rojo)
- Botón "Exportar para WhatsApp" (copia texto formateado al portapapeles)
- Backend y frontend independientes de Presupuestos Local

### Sidebar (Menú Lateral)
- Diseño acordeón: clic expande, los demás se cierran
- Fondo blanco, botones rojos (#b91c1c), activo fondo rojo (#e63946) con texto blanco
- Header "MENÚ" en rojo con pin 📌
- Auto-ocultable: hover en borde izquierdo lo muestra, sale solo
- Sin hamburguesa mobile
- Contenido se desplaza 300px con transición al abrir
- Grupos: INICIO, PRESUPUESTOS (Local / En Línea / Realizados), ÓRDENES (Nueva / Activas / En Taller / Entregadas), HERRAMIENTAS/STOCK (Piletas / Materiales / Calculadora), AGENDA (Clientes / Mediciones), REPORTES, CONFIGURACIÓN

### Dashboard
- Header rojo (#e51a24) full-width con "afamar" en Playfair Display (serif)
- Grilla de 8 tarjetas interactivas con hover (translateY -3px):
  - CAJA (borde azul, total ingresos) | NUEVO PRESUPUESTO | NUEVA ORDEN
  - ÓRDENES EN MEDICIÓN / TALLER (ancha, con métricas)
  - ÓRDENES TERMINADAS P/ ENVÍO | STOCK DE PILETAS | CATÁLOGO DE COLORES
  - PRESUPUESTOS EN LÍNEA (tarjeta vertical derecha)

### API Endpoints principales
- `GET /api/presupuestos/next-numero` — número P-XXXXXX
- `GET /api/ordenes-trabajo/next-numero` — número A-XXXXXX
- `POST /api/presupuestos/{id}/convertir-orden` — copia COMPLETA del presupuesto a orden
- `GET /api/presupuestos-online` — CRUD independiente
- `POST /api/presupuestos/{id}/enviar-whatsapp` y `/enviar-email`
- `GET /api/presupuestos/{id}/pdf` y `GET /api/ordenes-trabajo/{id}/pdf`
- `POST /api/configuracion/upload-logo`

## Problemas resueltos
1. **`pydantic-core` no compila en Python 3.14**: versiones `>=` en requirements.txt para wheels precompilados.
2. **`NameError: Cliente`**: schema pisaba modelo. Renombrado a `ClienteModel`/`ClienteSchema`.
3. **ML (medida lineal) eliminado**: solo se usa M² en cómputo de piezas.
4. **Ancho cm/mm -> M² incorrecto**: `updateItem` aplicaba `toMeters` sobre valores ya en metros (doble división). Corregido usando `largo`/`ancho` directamente.
5. **Material toggle perdía precio ARS**: toggle ahora solo controla display/edición, no sobreescribe `material_precio_m2`.
6. **MovimientoPiletaCreate requires pileta_id en body**: schema cambiado a `pileta_id: Optional[int] = None`. Router lo asigna desde URL.

## Decisiones tomadas
- SQLite para desarrollo (cambiar a PostgreSQL en producción).
- CORS abierto (`allow_origins=["*"]`).
- Sin autenticación.
- Sidebar acordeón flotante, contenido se desplaza 300px al abrir.
- PresupuestoForm es copia exacta de OrdenForm (mismos paneles, campos, lógica).
- `dolar_dia` es la cotización del presupuesto, se congela al guardar (no se actualiza automáticamente).
- Conversión Presupuesto → Orden copia TODO: croquis, firma, pileta, detalles_fabricacion, precios ARS/USD, dolar_dia.
- Presupuesto convertido NO se elimina, solo cambia estado a CONVERTIDO A OT.
- Lista de presupuestos excluye CONVERTIDO A OT por defecto (backend filtra cuando estado está vacío).
- Presupuestos Online es un módulo completamente independiente (modelo/schema/router/frontend separados).
- `material_precio_m2` = ARS price, `material_precio_m2_usd` = USD price.
- Items y adicionales del viejo Presupuesto se mantienen en DB pero el nuevo formulario no los usa.
- DB SQLite se elimina manualmente cuando hay cambios de schema; recrear con `python seed.py`.

## Pendientes / Próximos pasos
- Migrar a PostgreSQL
- Autenticación de usuarios
- Módulo "TRABAJOS TERMINADOS" (tercera carpeta virtual)

## Cómo ejecutar
```bash
# Terminal 1 - Backend
cd afamar/backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd afamar/frontend
npm start

# Recrear DB (borrar afamar.db y ejecutar seed con backend corriendo)
cd afamar/backend
.\venv\Scripts\python seed.py
```

## Sesión 14-Jun-2026 (tarde) - 6 features completadas

### 1. Console.logs eliminados
- `OrdenForm.js`: removidos los 12 console.logs de debug (GET materiales, handleMaterialChange, handleDetalleChange, calculateTotals).

### 2. Logo en Configuración + PDF descargable
- **Backend**: `POST /api/configuracion/upload-logo` (multipart → `uploads/logo.png` + persist path en config key "logo").
- **Backend**: `GET /api/presupuestos/{id}/pdf` y `GET /api/ordenes-trabajo/{id}/pdf` — generan PDF via ReportLab con logo opcional.
- **Frontend**: Configuración ahora tiene selector de archivo + preview + botón "Subir Logo" (mantiene URL como fallback).
- **Frontend**: Cada fila de PresupuestosList y OrdenesList tiene botón PDF (FileDown icon) que abre el PDF en nueva pestaña.

### 3. Dashboard con más métricas
- **Backend**: Nuevos campos en `DashboardData`: `total_ordenes_activas`, `total_presupuestos`, `total_ordenes`, `total_ingresos`, `total_pendiente_cobro`, `ordenes_entregadas_mes`, `presupuestos_aprobados_mes`.
- **Frontend**: Nueva sección "MÉTRICAS" con 7 tarjetas en grilla responsive, mostrando valores con formato moneda donde corresponde.

### 4. Calculadora de aprovechamiento de placa (3.00×1.80)
- Nuevo componente `CalculadoraPlaca.js` en ruta `/calculadora`.
- Agrega piezas (largo×ancho×cantidad), calcula M² total, placas necesarias (`Math.ceil`), % utilización, % desperdicio.
- Barra de utilización coloreada (verde ≥80%, amarillo ≥60%, rojo <60%).
- Sidebar: nuevo link "Calculadora" con icono Calculator.

### 5. Agenda de mediciones con fotos
- **Backend**: Nuevo modelo `Medicion` en `models/medicion.py`, schema en `schemas/medicion.py`, router CRUD en `routers/mediciones.py`.
- **Frontend**: `MedicionesList.js` (búsqueda + filtro estado + tabla con acciones), `MedicionForm.js` (formulario completo con subida de fotos base64 y previews).
- Sidebar: nuevo link "Mediciones" con icono Calendar.
- Rutas: `/mediciones`, `/mediciones/nuevo`, `/mediciones/:id`.

### 6. Envío WhatsApp/Email
- **Backend**: Nuevo `services/email_service.py` (SMTP), config `SMTP_SERVER`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`.
- **Backend**: `POST /api/presupuestos/{id}/enviar-whatsapp` y `/enviar-email` — envían usando servicios existentes/nuevos.
- **Frontend**: Botones WhatsApp (Send verde) y Email (Mail outline) en cada fila de PresupuestosList.

### Bugs/Mejores
- `main.py`: `os.makedirs("uploads", exist_ok=True)` para directorio de uploads.
- `formatters.js`: añadidos estados `PENDIENTE`/`REALIZADA`/`CANCELADA` a `badgeClass`.

## Sesión 14-Jun-2026

### Nuevo
- Campo `moneda` (ARS/USD) en modelo Material + schema + seed.
- Campo `tipo_cambio` en modelo OrdenTrabajo + schema + router response.
- Convertidor USD→ARS en OrdenForm: al seleccionar material con `moneda: "USD"`, muestra precio en USD + input de tipo de cambio + equivalente en ARS.
- Autocompletado de espesor desde `espesor_disponible` del material (se agregaron "2 cm", "1.2 cm", "0.8 cm" al array `espesores` en formatters.js).
- Autocompletado de `precio_m2` al seleccionar material (ARS directo, USD convertido × tipo_cambio).
- Cálculo automático de CORTE/ZÓCALO/FRENTE: `precio = m² × material_precio_m2`.
- Recalculo automático de subtotales (se agregó `form.material_precio_m2` a dependencias del effect).
- Bloqueo de edición cuando estado es `EN EL TALLER` o `ENTREGADO`: todos los inputs/selects/textarea con `disabled=true`, CroquisEditor sin toolbar y canvas inerte, FirmaCanvas sin interacción y botón "Borrar firma" oculto. Botón GUARDAR permanece activo.

### Bugs corregidos
- **Espesor no se completaba**: el select solo tenía `['20 mm', '30 mm', '40 mm']` pero los materiales del seed tienen `'2 cm'`, `'1.2 cm'`, `'0.8 cm'`. Se agregaron esos valores al array.
- **materialPrecioRef desincronizado**: el effect que actualiza el ref no tenía `form.material_precio_m2` en sus dependencias. Agregado.
- **CORTE/ZÓCALO/FRENTE no calculaban precio**: consecuencia del ref desincronizado; al estar el ref en 0, `precio = m² × 0 = 0`.

### Debug
- Se agregaron `console.log` en: GET /api/materiales, handleMaterialChange, handleDetalleChange, calculateTotals para rastrear el flujo de datos.

### Refactor moneda (continuación 14-Jun-2026)
- **MaterialesList.js**: Eliminado toggle de moneda (ARS/USD). Ahora muestra ambas columnas fijas: PRECIO ARS ($) y PRECIO USD (USD). Precio USD en color verde suave `#059669`. Se agregó carga de `tipo_cambio` desde config para calcular USD cuando material no tiene `precio_m2_usd`.
- **Configuracion.js**: Agregado campo `tipo_cambio` ("Tipo de cambio USD") como input numérico en la lista de configuraciones.
- **MaterialForm.js**: Agregado auto-cálculo bidireccional. Si moneda base = ARS, modificar Precio ARS calcula automáticamente Precio USD ÷ tipo de cambio. Si moneda base = USD, modificar Precio USD calcula automáticamente Precio ARS × tipo de cambio. Al cambiar moneda base, se recalcula el otro precio automáticamente.
- **OrdenForm.js**: Panel MATERIALES ahora muestra siempre ambos precios (ARS y USD) y la moneda base al seleccionar un material, en un recuadro con fondo `#f8fafc`. Eliminado el convertidor USD→ARS con input de tipo de cambio (ya no es necesario porque se muestran ambas monedas simultáneamente). Función `handleTipoCambioChange` eliminada por no usarse.

### Gestión de clientes (continuación 14-Jun-2026)
- **Backend `routers/ordenes_trabajo.py`**: Al guardar orden (POST/PUT), `_find_or_create_cliente()` busca cliente por teléfono (prioridad 1), email (prioridad 2), nombre exacto (prioridad 3). Si existe, actualiza teléfono/domicilio/email + `updated_at`. Si no, crea nuevo Cliente. Asigna `cliente_id` a la orden. Búsqueda de órdenes ahora incluye `cliente_telefono_orden` y `email`.
- **Backend `routers/clientes.py`**: Listado (`GET /`) devuelve `total_ordenes`, `ultima_orden`, `created_at`. Ficha (`GET /{id}`) devuelve `ultima_orden` y array `ordenes` con id/numero/estado/total. Validación de teléfono único en POST/PUT.
- **Backend `schemas/cliente.py`**: Nuevo schema `ClienteList` con campos extra.
- **Frontend `ClientesList.js`**: Columnas ID, Órdenes (badge), Última orden, Fecha alta.
- **Frontend `ClienteForm.js`**: Panel Historial con tarjetas (Presupuestos, Órdenes, Total facturado, Última orden) + listado de Órdenes asociadas cliqueables.
- **Frontend `OrdenForm.js`**: Sin cambios visuales; la creación/actualización del cliente ocurre server-side al guardar.

## Sesión 14-Jun-2026 (final) — Presupuestos idénticos a Órdenes + Sidebar Acordeón + Dashboard Grid

### 1. PRESUPUESTOS LOCAL ahora es idéntico a Órdenes de Trabajo
- **Backend `models/presupuesto.py`**: Agregadas ~30 columnas nuevas iguales a OrdenTrabajo: `cliente_nombre`, `cliente_telefono_orden`, `email`, `domicilio`, `fecha`, `prioridad`, `subtotal`, `traslado`, `instalacion`, `descuento`, `sena_recibida`, `saldo_pendiente`, `saldo_pagado`, `fecha_pago_saldo`, `dolar_dia`, `subtotal_usd`, `traslado_usd`, `total_usd`, `sena_usd`, `saldo_pendiente_usd`, `fecha_entrega`, `firma_cliente`, `fecha_aprobacion`, `observaciones_diseno`, `observaciones_importantes`, `detalles_fabricacion`, `pileta_id`, `pileta_precio`, `pileta_imagen`, `stock_descontado`, `acabado`. Estado default: `PENDIENTE`.
- **Backend `schemas/presupuesto.py`**: Nuevo schema `FabricacionDetalle`. Agregados todos los campos nuevos a Base, Update y Response. Campo `orden_trabajo_numero` en response.
- **Backend `routers/presupuestos.py`**: 
  - `_find_or_create_cliente()` para auto-crear/actualizar clientes
  - `GET /next-numero` para obtener el próximo número
  - `PUT` ahora soporta auto-creación de cliente y manejo de pileta
  - `DELETE` restaura stock de pileta si `stock_descontado`
  - `convertir_a_orden` reescrito: copia TODOS los campos (croquis, firma, pileta, detalles_fabricacion, precios ARS/USD, dolar_dia, etc.). Verifica que no esté ya convertido. Cambia estado a `CONVERTIDO A OT`.
  - Búsqueda incluye `cliente_telefono_orden`
  - Listado excluye `CONVERTIDO A OT` por defecto (cuando no hay filtro de estado)
  - `_presupuesto_to_schema` incluye `orden_trabajo_numero` (del vínculo con la orden)
- **Frontend `PresupuestoForm.js`**: Copia exacta de `OrdenForm.js` con:
  - APIs de presupuestos (`getPresupuesto`, `createPresupuesto`, `updatePresupuesto`, `deletePresupuesto`, `getNextPresupuestoNumero`)
  - Estado default `PENDIENTE`
  - `readOnly` cuando estado es `CONVERTIDO A OT` o `RECHAZADO`
  - Botón CONVERTIR A ORDEN en el header (rojo, guarda + convierte en un solo paso)
  - Al convertir: auto-guarda con estado APROBADO, llama `convertirAOrden`, muestra OT creada
  - Menú tres puntos con opción Guardar
  - `fecha_entrega` como campo date visible
- **Frontend `PresupuestosList.js`**: 
  - Columnas: Número, Fecha, Cliente, Teléfono, Material, Total, Estado, Acciones
  - Dropdown: PRESUPUESTO LOCAL (default, excluye convertidos) / PRESUPUESTOS REALIZADOS
  - Acciones: Aprobar (PENDIENTE), CONVERTIR A OT (APROBADO), OT A-XXXXX link (CONVERTIDO), Rechazar, WhatsApp, Email, PDF, Eliminar
  - Sincronización de `searchParams` con estado (corregido bug de navegación entre filtros del menú)
  - Muestra `orden_trabajo_numero` debajo del número cuando está convertido

### 2. PRESUPUESTOS EN LÍNEA (módulo nuevo)
- **Backend**: `models/presupuesto_online.py` (columnas: numero, cliente, tipo_obra, fecha, items JSON, total_general, conversion, total_final), schema en `schemas/presupuesto_online.py`, router CRUD en `routers/presupuestos_online.py`
- **Frontend**:
  - `PresupuestosOnlineList.js`: listado con columnas Número, Cliente, Tipo de Obra, Fecha, Total, Conversión, Total Final
  - `PresupuestoOnlineForm.js`: tabla con 11 filas estándar (LONGITUD) + 7 filas especiales (ZÓCALOS, APERTURA + PEGADO PILETA, APERTURA PILETA APOYO, MENSULAS, APERTURA ANAFE, TERMINACIÓN, PILETA MOD). Cálculos automáticos de M² y subtotales. CONVERSIÓN (fondo rojo). Botón Exportar para WhatsApp (copia texto formateado).
- Registrado en `main.py` como `/api/presupuestos-online`
- Rutas frontend: `/presupuestos-online`, `/presupuestos-online/nuevo`, `/presupuestos-online/:id`

### 3. Sidebar rediseñado (acordeón)
- **`Layout.js`**: Reescrito con estructura acordeón. 7 grupos: INICIO, PRESUPUESTOS (Local/En Línea/Realizados), ÓRDENES DE TRABAJO (Nueva/Activas/En Taller/Entregadas), HERRAMIENTAS/STOCK (Piletas/Materiales/Calculadora), AGENDA (Clientes/Mediciones), REPORTES, CONFIGURACIÓN. Sub-ítems con bullet rojo (•). Flecha gira al expandir. Contenido se desplaza 300px con transición. Sin hamburguesa mobile.
- **`index.css`**: Sidebar fondo blanco, botones rojos (#b91c1c), activo rojo (#e63946) con texto blanco, submenú fondo #f8fafc. Pin button. Trigger edge rojo.

### 4. Dashboard rediseñado
- **`Dashboard.js`**: Header rojo (#e51a24) full-width con "afamar" en Playfair Display. Grilla CSS Grid: 3 columnas izquierda + 1 columna derecha. 8 tarjetas interactivas con hover (translateY -3px): CAJA (borde azul, total ingresos), NUEVO PRESUPUESTO, NUEVA ORDEN, ÓRDENES EN MEDICIÓN / TALLER (ancha x3, con métricas), ÓRDENES TERMINADAS P/ ENVÍO, STOCK DE PILETAS, CATÁLOGO DE COLORES, PRESUPUESTOS EN LÍNEA (vertical derecha).

### 5. searchParams sincronizados
- Bug: al navegar desde el menú lateral con `?estado=...` o `?search=...`, el estado del componente no se actualizaba porque `useState` solo corre al montar.
- Corregido en `PresupuestosList.js` y `OrdenesList.js`: useEffect que sincroniza `search` y `estado` con `searchParams` cada vez que cambia la URL.

### 6. Estados actualizados
- `formatters.js`: `estadosPresupuestoLocal = ['PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO']`. BadgeClass incluye ENVIADO, RECHAZADO, CONVERTIDO A OT.

### 7. Columnas nuevas en Presupuesto
- `fecha` (DateTime) — fecha del presupuesto
- `dolar_dia` (Float, default 1000) — cotización congelada
- `subtotal_usd`, `traslado_usd`, `total_usd`, `sena_usd`, `saldo_pendiente_usd` — equivalentes en USD

### Archivos relevantes
- `backend/app/models/presupuesto.py` — ~30 columnas nuevas + fecha
- `backend/app/models/presupuesto_online.py` — nuevo modelo
- `backend/app/schemas/presupuesto.py` — FabricacionDetalle + orden_trabajo_numero
- `backend/app/schemas/presupuesto_online.py` — nuevo schema
- `backend/app/routers/presupuestos.py` — convertir reescrito, _find_or_create_cliente, next-numero, excluye CONVERTIDO
- `backend/app/routers/presupuestos_online.py` — nuevo router CRUD
- `backend/app/main.py` — registrado presupuestos_online
- `frontend/src/components/Layout.js` — sidebar acordeón
- `frontend/src/components/dashboard/Dashboard.js` — header rojo + grilla
- `frontend/src/components/presupuestos/PresupuestoForm.js` — copia de OrdenForm
- `frontend/src/components/presupuestos/PresupuestosList.js` — lista con searchParams sync
- `frontend/src/components/presupuestos/PresupuestoOnlineForm.js` — tabla 11+7 filas
- `frontend/src/components/presupuestos/PresupuestosOnlineList.js` — listado online
- `frontend/src/components/ordenes/OrdenesList.js` — searchParams sync
- `frontend/src/services/api.js` — getNextPresupuestoNumero, convertirAOrden, APIs online
- `frontend/src/utils/formatters.js` — estadosPresupuestoLocal, badgeClass actualizado
- `frontend/src/App.js` — rutas presupuestos-online
- `frontend/src/index.css` — sidebar acordeón, dash-card hover, Playfair Display

## Sesión 15-Jun-2026 — Moneda mixta, espejo ARS/USD, finalizado eliminado, presupuesto online mejorado

### 1. Dólar del Día permite 0
- Eliminados todos los `|| 1` y `|| 1000` en OrdenForm, PresupuestoForm y PresupuestoOnlineForm
- Divisiones protegidas con `dd > 0`. Cuando dd = 0, valores USD se muestran en 0.

### 2. CORTE renombrado a LONGITUD
- `formatters.js`: `conceptosFabricacion` cambió `CORTE` → `LONGITUD`
- `OrdenForm.js` y `PresupuestoForm.js`: `CONCEPTOS_M2`, `addDetalle` actualizados

### 3. FINALIZADO eliminado de órdenes
- `estadosOrden = ['EN MEDICIÓN', 'EN EL TALLER', 'ENTREGADO']`
- Backend: excluye ENTREGADO por defecto cuando no hay filtro de estado
- Confirmar pago NO cambia estado, solo marca `saldo_pagado`
- Dropdown de OrdenesList: "Activas" por defecto

### 4. Material auto-completa y bloquea espesor
- Al seleccionar material, COLOR y ESPESOR se autocompletan desde la ficha
- Espesor se bloquea: `disabled={readOnly || !!form.material}`
- Default `'20 mm'` cambiado a `''` en handleMaterialChange
- Espesores simplificado: solo `['2 cm', '1.2 cm']`

### 5. Columna Moneda en Detalle de Fabricación
- Schema `FabricacionDetalle`: campo `moneda: str = "ARS"` en ambos schemas (presupuesto y orden_trabajo)
- Tabla de fabricación: nueva columna Moneda con select ARS/USD
- Precio usa `material_precio_m2` (ARS) o `material_precio_m2_usd` (USD) según moneda
- Display: verde para USD, negro para ARS
- `handleDetalleChange` recalcula precio al cambiar moneda (incluye `field === 'moneda'`)

### 6. Pileta con selector ARS/USD
- Modelos: `pileta_moneda` (String, default "ARS") en presupuesto y orden_trabajo
- Panel Pileta: selector Moneda + precio editable (input type number)
- Display en verde (USD) o azul (ARS)
- Al cambiar moneda, recalcula precio desde stock (precio o precio_usd)
- `calculateTotals`: pileta en USD se convierte a ARS vía dolar_dia
- Dependencia `pileta_moneda` agregada al efecto de cálculo
- Presupuesto panel: pileta aparece en columna correcta según moneda

### 7. Stock de Piletas: precio_usd
- Modelo: `precio_usd` (Float, default 0)
- Tabla: columnas Precio ARS + Precio USD
- Formulario: campos Precio ARS ($) + Precio USD
- Al seleccionar pileta en presupuesto/orden: auto-completa precio según moneda seleccionada
- Al cambiar moneda de pileta: actualiza precio desde el valor correspondiente en stock

### 8. Efecto espejo en PRESUPUESTO (ARS ↔ USD)
- **Todos los ítems** aparecen en ambas columnas
- ARS: ítems USD convertidos (`precio_usd × dolar_dia`), ítems ARS directos
- USD: ítems ARS convertidos (`precio_ars / dolar_dia`), ítems USD directos
- Pileta también replicada en ambas columnas con conversión
- Al cambiar Dólar del Día, todo se recalcula al instante

### 9. Confirmar pago: saldo → 0, seña = total
- Al confirmar: `sena_recibida = total`, `saldo_pendiente = 0`, `sena_usd = total_usd`, `saldo_pendiente_usd = 0`
- Al deshacer: solo cambia `saldo_pagado = false`, no modifica montos
- Eliminado texto "Presupuesto finalizado" (no aplica al flujo actual)

### 10. TOTAL ARS / USD visible debajo de saldo
- Recuadro con TOTAL ARS (rojo) y TOTAL USD (verde) entre Confirmar pago y Forma de pago
- Aplica en OrdenForm y PresupuestoForm

### 11. PresupuestosList: botones con texto
- PDF, WhatsApp, Email ahora son botones con ícono + texto (antes solo íconos)
- Layout de acciones en 2 filas: arriba estado, abajo comunicación + eliminar

### 12. Presupuesto Online mejorado
- **Select de materiales**: reemplaza datalist por `<select>` cliqueable con todos los materiales
- **Formato**: "LONGITUD : [▼ material]" con prefijo fijo
- **Totales**: TOTAL NETO ARS / TOTAL NETO USD / TOTAL CONSOLIDADO (reemplaza TOTAL GRAL + CONVERSIÓN)
- **Moneda por fila**: selector ARS/USD en cada fila
- **DÓLAR DEL DÍA** en header
- **ZÓCALOS**: inputs Largo × Altura visibles, calcula M²
- **Especiales por unidad**: sin dropdown de materiales (APERTURA + PEGADO PILETA, MENSULAS, ANAFE, TERMINACIÓN, PILETA MOD)
- **recalcFrom**: corregido bug de estado viejo — ahora calcula sobre datos reales, no del state
- **handleDetalleChange**: para especiales, solo actualiza moneda/precio sin cambiar nombre

### 13. Backend PresupuestoOnline actualizado
- Modelo: `dolar_dia`, `total_neto_ars`, `total_neto_usd`, `total_consolidado` (reemplazan `total_general`, `conversion`, `total_final`)
- Schema `PresupuestoOnlineItem`: campo `moneda` agregado
- Listado: columnas Total ARS, Total USD, Consolidado

### Archivos modificados
- `backend/app/models/presupuesto.py` — pileta_moneda
- `backend/app/models/orden_trabajo.py` — pileta_moneda
- `backend/app/models/stock_pileta.py` — precio_usd
- `backend/app/models/presupuesto_online.py` — dolar_dia, total_neto_ars/usd/consolidado
- `backend/app/schemas/presupuesto.py` — FabricacionDetalle.moneda, pileta_moneda
- `backend/app/schemas/orden_trabajo.py` — FabricacionDetalle.moneda, pileta_moneda
- `backend/app/schemas/stock_pileta.py` — precio_usd
- `backend/app/schemas/presupuesto_online.py` — dolar_dia, moneda en items, totales nuevos
- `backend/app/routers/ordenes_trabajo.py` — excluye ENTREGADO por defecto
- `backend/app/routers/presupuestos.py` — pileta_moneda en convertir y _to_schema, excluye CONVERTIDO A OT
- `frontend/src/components/ordenes/OrdenForm.js` — dolar_dia 0, LONGITUD, moneda fabricación, pileta moneda, espejo, confirmar pago, totales
- `frontend/src/components/presupuestos/PresupuestoForm.js` — mismos cambios que OrdenForm
- `frontend/src/components/presupuestos/PresupuestosList.js` — botones con texto, layout 2 filas, dropdown simplificado
- `frontend/src/components/presupuestos/PresupuestoOnlineForm.js` — select materiales, moneda, totales ARS/USD/consolidado, dolar_dia, zócalos largo×altura
- `frontend/src/components/presupuestos/PresupuestosOnlineList.js` — columnas ARS/USD/consolidado
- `frontend/src/components/ordenes/OrdenesList.js` — searchParams sync, dropdown "Activas"
- `frontend/src/components/stock/StockPiletas.js` — precio_usd
- `frontend/src/utils/formatters.js` — LONGITUD, espesores, estadosOrden sin FINALIZADO

## Sesión 15-Jun-2026 (tarde) — PDF premium, medición comparativa, online dinámico, unificado

### 1. PDF rediseñado (diseño premium)
- `pdf_generator.py` reescrito completo. Header: "afamar" Times Bold + "MÁRMOLES & GRANITOS" + N° en rojo centrado + datos La Plata
- 3 tarjetas con bordes, padding 14pt, gap 14pt entre columnas. Label/value alineados (gris izq, negrita der)
- Píldoras de pago: EFECTIVO | TRANSFERENCIA | TARJETA con fondo gris, borde redondeado
- Observaciones en caja roja clara con tildes ✓. Firmas centradas al pie
- Page margins: 22mm top/bottom, 18mm sides. ReportLab maneja page-break automático

### 2. Comparativa de medición en Órdenes
- Backend: `detalles_presupuestados` (JSON) en OrdenTrabajo. Se copia de `detalles_fabricacion` al convertir presupuesto → orden
- Frontend: cuando estado es "EN MEDICIÓN", tabla debajo de fabricación muestra M² Presupuestado vs M² Real vs Δ
- Colores: verde (+Δ, más material), rojo (−Δ, menos), gris (0, sin cambios)

### 3. Stock Piletas: marca con dropdown + precio_usd
- Marca: select con JOHNSON / MI PILETA / OTRA (escribir). Si OTRA, aparece input de texto
- `precio_usd` agregado al modelo, tabla muestra ambas columnas (Precio ARS + Precio USD)

### 4. Presupuesto Online: dinámico
- Inicia con 3 filas LONGITUD (no 11). Botón "+ Agregar otra longitud"
- Especiales inicia solo con ZÓCALOS. Dropdown para elegir tipo y "+ Agregar"
- Cada fila tiene 🗑️ para eliminar. Subtotales y totales se actualizan al instante
- PILETA MOD: dropdown de piletas del stock, no descuenta. Moneda cambia precio entre ARS/USD
- TERMINACIÓN: input de texto + METROS LINEALES × MANO DE OBRA = subtotal
- Botón CONVERTIR A OT (cuando isEdit), crea Orden copiando ítems y totales
- `mano_de_obra` agregado a PresupuestoOnlineItem

### 5. Numeración compartida
- `generar_numero_presupuesto` busca en ambas tablas (Presupuesto + PresupuestoOnline) y usa el máximo + 1
- P-000001, P-000002... secuencia única sin importar el tipo

### 6. Lista unificada PRESUPUESTOS
- Endpoint `GET /api/presupuestos/unificados` combina locales + online
- Columna Tipo: badge "ONLINE" en azul para distinguirlos
- Online: sin botones de Aprobar/Rechazar/Convertir (tienen su propio Convertir a OT)
- Dropdown: PRESUPUESTOS (default, no convertidos + online) / PRESUPUESTOS REALIZADOS (solo convertidos)
- `estado` agregado al modelo PresupuestoOnline

### 7. Moneda se auto-setea y bloquea
- `handleMaterialChange`: al seleccionar material, TODAS las filas heredan su moneda
- Moneda bloqueada (`disabled={readOnly || !!form.material}`) — el material manda
- `addDetalle`: nuevas filas heredan moneda del material actual
- PresupuestoOnline: moneda bloqueada en LONGITUD al elegir material, moneda bloqueada en ZÓCALOS al elegir material

### 8. Varios fixes
- `fecha_entrega`: campo date agregado en ambos forms (Orden y Presupuesto)
- Confirmar pago: saldo → 0, seña = total, también en USD
- TOTAL ARS / USD visible debajo del bloque Confirmar pago
- Dólar del Día permite 0 (todos los `|| 1` y `|| 1000` eliminados)
- Sidebar: "NUEVO PRESUPUESTO EN LÍNEA" → `/presupuestos-online/nuevo`
- PresupuestoOnline: numeración visible en header, totales cargan al editar

### Archivos modificados
- `backend/app/services/pdf_generator.py` — reescrito completo
- `backend/app/models/orden_trabajo.py` — detalles_presupuestados
- `backend/app/models/presupuesto_online.py` — estado, pileta_id, pileta_precio, ForeignKey
- `backend/app/models/stock_pileta.py` — precio_usd
- `backend/app/schemas/presupuesto_online.py` — estado, mano_de_obra, pileta_id/precio
- `backend/app/utils/numeracion.py` — contar ambas tablas
- `backend/app/routers/presupuestos.py` — unificados, convertir copia detalles_presupuestados
- `backend/app/routers/presupuestos_online.py` — convertir a orden, estado
- `backend/app/routers/ordenes_trabajo.py` — detalles_presupuestados en _to_schema
- `backend/app/schemas/orden_trabajo.py` — detalles_presupuestados
- `frontend/src/components/ordenes/OrdenForm.js` — addDetalle moneda, comparativa medición, moneda lock
- `frontend/src/components/presupuestos/PresupuestoForm.js` — addDetalle moneda, moneda lock
- `frontend/src/components/presupuestos/PresupuestoOnlineForm.js` — reescrito (dinámico, pileta, terminación, convertir)
- `frontend/src/components/presupuestos/PresupuestosList.js` — unificado, convertir online, deleteTipo
- `frontend/src/components/stock/StockPiletas.js` — marca dropdown + precio_usd
- `frontend/src/components/Layout.js` — sidebar link a /nuevo
- `frontend/src/services/api.js` — unificados, convertirOnlineAOrden

## Sesión 15-Jun-2026 (final) — Múltiples materiales, piletas múltiples, espejo condicional, croquis mejorado

### 1. Material por fila en Detalle de Fabricación
- Columna **Material** agregada a la tabla de fabricación (entre Concepto y Detalle)
- Solo visible cuando el concepto es LONGITUD, ZÓCALO o FRENTE (`CONCEPTOS_M2`)
- Cada fila tiene su propio select de materiales con todos los materiales cargados
- Al seleccionar material: auto-set Moneda, auto-calcula Precio con su `precio_m2` o `precio_m2_usd`
- Moneda se bloquea al seleccionar material (`disabled={readOnly || !!d.material}`)
- `FabricacionDetalle` schema: campos `material` y `material_precio_m2` agregados
- `handleDetalleChange`: material por fila recalcula precio con el `precio_m2` del material específico
- `addDetalle`: nuevas filas incluyen `material: ''` y `material_precio_m2: 0`

### 2. Panel MATERIALES rediseñado (múltiples materiales)
- Eliminado el selector único de material, Color/Tipo, Espesor, Acabado
- **+ AGREGAR MATERIAL**: dropdown para sumar tarjetas de material
- Cada tarjeta muestra: **Nombre** (✕ para eliminar), **Categoría**, **Precio M²** (en moneda nativa: USD verde, ARS negro)
- Campo `materiales` (JSON array) en OrdenTrabajo y Presupuesto
- Al guardar, todos los materiales se persisten
- Panel MATERIALES se oculta si no hay filas LONGITUD/ZÓCALO/FRENTE en fabricación (croquis ocupa 100%)

### 3. Piletas múltiples con Cantidad
- Panel **PILETAS** (renombrado) acepta múltiples piletas
- **+ AGREGAR PILETA** sin límite de duplicados
- Cada tarjeta: **Marca - Modelo** | **Cant.** | **Moneda** (ARS/USD) | **Precio** | ✕
- Al cambiar moneda, precio se actualiza desde `precio` o `precio_usd` del stock (juntos en una sola operación)
- Campo `piletas` (JSON array) en OrdenTrabajo y Presupuesto
- Backend: `StockPiletaUpdate` ahora incluye `precio_usd`

### 4. Espejo condicional en PRESUPUESTO
- Si **no hay USD** (materiales, fabricación, piletas): columna USD oculta, DÓLAR DEL DÍA oculto, TOTAL USD oculto, ARS 100%
- Si **hay USD**: vista bimonetaria completa con ambas columnas, DÓLAR DEL DÍA visible
- SUBTOTALES ARS: solo ítems en ARS + piletas ARS
- SUBTOTALES USD: solo ítems en USD + piletas USD
- Sin conversión entre columnas (no espejo)
- Piletas muestran desglose individual: "Pileta JOHNSON - E44 (x2) $300.000"
- `calculateTotals`: ppArs solo suma piletas ARS, ppUsd solo suma piletas USD (sin conversión)
- `hayUSD` computado en componente (no IIFE)

### 5. MaterialForm simplificado
- Un solo input **Precio M²** + selector **Moneda** (ARS/USD) lado a lado
- Eliminados Precio ARS / Precio USD separados y Moneda base independiente
- MaterialesList: una sola columna **Precio M²** (ARS negro, USD verde), sin columna duplicada

### 6. CroquisEditor mejorado
- Texto: click posiciona el texto donde se hizo clic (no siempre en el mismo lugar)
- Rotación de texto: selector 0°/45°/90°/180°/270°/-45°/-90° junto al input de texto
- Medida: prompt para editar manualmente la etiqueta (ej: "2.40 mts", "620 mm")

### 7. Varios fixes
- `dolar_dia` permite 0 en todos los formularios
- `fecha_entrega` campo date visible en ambos forms
- Confirmar pago: `sena = total, saldo = 0` (también en USD)
- StockPiletas: Marca con dropdown JOHNSON/MI PILETA/OTRA + input libre
- PresupuestoOnline: `hayUSD` oculta TOTAL NETO USD cuando no hay ítems en USD
- Material auto-setea y bloquea moneda por fila (el material manda)

### Archivos modificados
- `backend/app/models/orden_trabajo.py` — materiales JSON, piletas JSON
- `backend/app/models/presupuesto.py` — materiales JSON, piletas JSON
- `backend/app/schemas/orden_trabajo.py` — FabricacionDetalle.material/precio_m2, materiales, piletas
- `backend/app/schemas/presupuesto.py` — FabricacionDetalle.material/precio_m2, materiales, piletas
- `backend/app/schemas/stock_pileta.py` — precio_usd en Update
- `backend/app/routers/ordenes_trabajo.py` — materiales, piletas en _to_schema
- `backend/app/routers/presupuestos.py` — materiales, piletas en _to_schema y convertir
- `frontend/src/components/ordenes/OrdenForm.js` — material por fila, multi-materiales, multi-piletas, espejo condicional, hayUSD
- `frontend/src/components/presupuestos/PresupuestoForm.js` — mismos cambios que OrdenForm
- `frontend/src/components/presupuestos/PresupuestoOnlineForm.js` — hayUSD en totales
- `frontend/src/components/materiales/MaterialForm.js` — Precio M² único + Moneda
- `frontend/src/components/materiales/MaterialesList.js` — columna Precio M² única
- `frontend/src/components/stock/StockPiletas.js` — marca dropdown + precio_usd fix
- `frontend/src/components/ordenes/CroquisEditor.js` — texto posicionable, rotación, medida editable

## Sesión 16-Jun-2026 — Material por fila, piletas dinámicas, recargo financiero, calculadora mejorada

### 1. Material por fila + Largo/Ancho/Cantidad en panel MATERIALES
- Cada material en el panel MATERIALES tiene Largo × Ancho inputs con M² y Precio Final calculados automáticamente
- Se eliminó el filtro de duplicados — un mismo material se puede agregar múltiples veces
- Campo `cantidad` en cada material (multiplica M² y precio)
- `matArs` / `matUsd` calculados en calculateTotals (incluyen cantidad)
- Materiales se renderizan en SUBTOTALES (ARS) y (USD) del panel PRESUPUESTO
- `form.materiales` agregado a dependencias del useEffect de calculateTotals

### 2. Piletas dinámicas con cantidad
- Panel PILETAS permite múltiples piletas sin límite de duplicados
- Cada pileta: Cant., Moneda (ARS/USD), Precio, ✕
- Al cambiar moneda, precio se actualiza desde el stock (ARS o USD) en una sola operación
- `form.piletas` agregado a dependencias del useEffect
- Carga de `piletas` desde API al editar (bugfix: faltaba en data loading)
- Piletas ARS solo en SUBTOTALES ARS, piletas USD solo en USD

### 3. Recargo financiero por cuotas
- Forma de pago: select con EFECTIVO / TRANSFERENCIA BANCARIA / TARJETA DE DÉBITO / TARJETA DE CRÉDITO
- Al elegir TARJETA DE CRÉDITO: selector de cuotas (1 a 12)
- Recargo: 5% por cuota desde la 3ra en adelante (1=0%, 2=0%, 3=15%, 6=30%, 12=60%)
- Recargo visible en panel PRESUPUESTO (línea roja entre Traslado y TOTAL)
- Cuotas info: "6 cuotas mensuales fijas de $X" debajo de Forma de pago
- `form.cuotas`, `form.forma_pago` agregados a dependencias del useEffect
- Recargo se recalcula al cambiar cuotas o forma de pago

### 4. Cantidad en Detalle de Fabricación
- Nueva columna **Cant** en la tabla de fabricación
- Cada fila tiene input de cantidad (default 1)
- `cantidad: 1` agregado a `addDetalle`
- Display en SUBTOTALES muestra "x2" cuando cantidad > 1
- Precio se almacena como total (no unitario), cantidad es informativa
- TRAFORO DE PILETA DE APOYO renombrado (antes TRAFORO DE APOYO)

### 5. Calculadora de placa mejorada
- Placa estándar editable (inputs para Largo y Ancho)
- Ancho de disco (kerf): +3mm por lado por pieza
- `totalM2Bruto` calcula área real incluyendo kerf
- Placas necesarias calculadas sobre área bruta
- Utilización sobre área bruta, desperdicio más realista
- Nota informativa: "Corte de disco: +3 mm por lado por pieza"

### 6. PresupuestoForm sincronizado con OrdenForm
- Agregadas todas las features faltantes: Cantidad columna, recargo financiero, cuotas, forma de pago select, TRAFORO DE PILETA DE APOYO
- Ambos formularios ahora son funcionalmente idénticos

### Archivos modificados
- `frontend/src/components/ordenes/OrdenForm.js` — cantidad en fabricación, recargo, cuotas, materiales en PRESUPUESTO
- `frontend/src/components/presupuestos/PresupuestoForm.js` — sincronizado con OrdenForm
- `frontend/src/components/presupuestos/PresupuestoOnlineForm.js` — hayUSD
- `frontend/src/components/calculadora/CalculadoraPlaca.js` — placa editable, kerf 3mm, bruto
- `frontend/src/utils/formatters.js` — TRAFORO DE PILETA DE APOYO
