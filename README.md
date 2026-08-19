# bff-solicitudes

BFF del **Workflow de Solicitudes** (Caja Los Andes) que consumirá el Portal de Gestión Contable
en Retool. Migra a NestJS las conexiones y la lógica de negocio que hoy vive en
`Workflow_Contabilidad/server_mock.py`, empezando por las dos pantallas en curso: **Bandeja
Contable** e **Ingresar Solicitud**.

## Alcance de esta versión

Implementado:
- `GET /solicitudes` — Bandeja Contable, paginada y filtrada en el servidor, con SLA/estado/
  acciones ya resueltos (el front sólo pinta).
- `POST /solicitudes` — Ingresar Solicitud, en una transacción (cabecera + líneas de ajuste R23 +
  bitácora), con el motor de reglas por monto y el chequeo de gasto duplicado.
- `GET /catalogos` — rutas, CECOs y medios de pago para llenar los desplegables del formulario.

Deliberadamente fuera de esta versión (ver `CONTEXTO_BASE_WORKFLOW_COMPLEMENTO.md` en la raíz del
proyecto): aprobar/rechazar/reparar, contabilizar en SAP, TRACTA, usuarios, presupuesto, y
autenticación real con Keycloak.

## Requisitos

- Node 20+
- Acceso de red a la Postgres `bd_cla_prod` (esquema `workflow_contabilidad`)

## Configuración

```bash
cp .env.example .env
# completar DB_HOST / DB_USER / DB_PASSWORD
npm install
```

## Ejecutar

```bash
npm run start:dev
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health check: `GET /health`

## Decisiones de diseño que hay que conocer antes de tocar el código

1. **`synchronize: false` siempre.** El esquema ya existe y lo gestiona `schema.sql` /
   migraciones futuras del equipo de datos. TypeORM sólo lee y escribe, nunca migra el esquema
   automáticamente.
2. **SLA y acciones se calculan en el servicio, no en la entidad ni en el front**
   (`src/common/sla.util.ts`, `src/common/estado-solicitud.util.ts`). Es la regla del contrato:
   Retool pinta lo que llega, no reimplementa lógica de negocio.
3. **La confidencialidad de rutas (R15, R19) está hardcodeada** en
   `src/common/confidencialidad.util.ts`, igual que en el prototipo. Está marcado con TODO para
   moverse a una columna `confidencial` en `rutas_pago` — evita tocar código cada vez que cambie
   el catálogo de 23 rutas.
4. **El enmascaramiento RLS asume `puedeVerConfidenciales = false`** en todos lados hasta que
   exista sesión real. Es la postura restrictiva por defecto: sin login, nadie ve confidenciales.
5. **Los errores siempre responden `{ codigo, mensaje, detalle, reintentable }`**
   (`src/common/http-exception.filter.ts`), incluidos los de validación automática de Nest. Así el
   front distingue `VALIDACION` de `REGLA_NEGOCIO` sin parsear texto libre.
6. **Cuatro columnas de `solicitudes_gasto` no están en `schema.sql`** pero sí en la base real
   (`medio_pago`, `beneficiario_cheque`, `beneficiario_rut`, `nro_documento_sap`) — las agregó
   `server_mock.py` en caliente al arrancar. Ya están mapeadas en la entidad; si `schema.sql` se
   actualiza, esto queda consistente solo.

## Pendiente conocido

- Credencial de base de datos compartida con el prototipo, pendiente de rotar (ver nota en
  `.env`).
- El proyecto Retool corre en un servidor gestionado por CLA que debe poder alcanzar este BFF por
  red — la URL de despliegue todavía no está definida.
