-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'SUPERVISOR', 'TECNICO', 'SECRETARIA');

-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('INTERNET', 'CABLE', 'DUO');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'CORTADO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoOrden" AS ENUM ('INSTALACION_I', 'ALTA_SERVICIO_I', 'ATENCION_NOC_I', 'AVERIA_I', 'BAJA_SERVICIO_I', 'CAMBIO_CONTRASENA_I', 'CAMBIO_DOMICILIO_I', 'CAMBIO_EQUIPO_I', 'CAMBIO_PLAN_I', 'CAMBIO_TITULAR_I', 'CORTE_SOLICITUD_I', 'CORTE_DEUDA_I', 'RECONEXION_I', 'RETIRO_EQUIPO_I', 'TRASLADO_I', 'INSTALACION_C', 'ALTA_SERVICIO_C', 'AVERIA_C', 'CAMBIO_DOMICILIO_C', 'CAMBIO_PLAN_C', 'CAMBIO_TITULAR_C', 'CORTE_SOLICITUD_C', 'CORTE_DEUDA_C', 'INSTALACION_ANEXO_C', 'MIGRACION_FTTH_C', 'RECONEXION_C', 'RETIRO_EQUIPO_C', 'SUPERVISION_C', 'TRASLADO_C', 'INSTALACION_D', 'ALTA_SERVICIO_D', 'AVERIA_D', 'CAMBIO_DOMICILIO_D', 'CAMBIO_EQUIPO_D', 'CAMBIO_PLAN_D', 'CAMBIO_TITULAR_D', 'CORTE_SOLICITUD_D', 'CORTE_DEUDA_D', 'RECONEXION_D', 'RETIRO_EQUIPO_D', 'TRASLADO_D', 'BAJA_SERVICIO_D');

-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO', 'EXONERADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA');

-- CreateEnum
CREATE TYPE "TipoMetodoPago" AS ENUM ('YAPE', 'PLIN', 'CUENTA_BANCARIA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "dispositivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "categoria" TEXT,
    "unidad" TEXT,
    "descripcion" TEXT,
    "esMedible" BOOLEAN NOT NULL DEFAULT false,
    "metrosPorUnidad" DOUBLE PRECISION,
    "metrosDisponibles" DOUBLE PRECISION,
    "tieneVariantes" BOOLEAN NOT NULL DEFAULT false,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "stockTotal" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "proveedor" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_variantes" (
    "id" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "genero" TEXT,
    "talla" TEXT,
    "codigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tecnicos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "zona" TEXT,
    "vehiculo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secretarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secretarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "dniRuc" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntos_red" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "capacidad" INTEGER,
    "ocupados" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "direccion" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puntos_red_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoServicio" "TipoServicio" NOT NULL,
    "mbps" INTEGER,
    "precio" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "sector" TEXT,
    "tipoServicio" "TipoServicio" NOT NULL,
    "ipWan" TEXT,
    "mascara" TEXT,
    "gateway" TEXT,
    "pppoeUsuario" TEXT,
    "pppoePassword" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "precinto" TEXT,
    "planId" TEXT,
    "mbps" INTEGER,
    "costoMensual" DECIMAL(10,2),
    "diaCorte" INTEGER,
    "puntoRedId" TEXT,
    "equipoProductoId" INTEGER,
    "equipoSerie" TEXT,
    "tecnicoInstaladorId" TEXT,
    "fechaInstalacion" TIMESTAMP(3),
    "estado" "EstadoContrato" NOT NULL DEFAULT 'ACTIVO',
    "motivoBaja" TEXT,
    "fechaBaja" TIMESTAMP(3),
    "fechaCorte" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos_mensuales" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'PENDIENTE',
    "nota" TEXT,
    "montoOriginal" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL,
    "observacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_cargos" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pago_cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_servicio" (
    "id" TEXT NOT NULL,
    "nServicio" TEXT NOT NULL,
    "contratoId" TEXT,
    "tipoOrden" "TipoOrden" NOT NULL,
    "estado" "EstadoOrden" NOT NULL DEFAULT 'PENDIENTE',
    "fechaServicio" TIMESTAMP(3) NOT NULL,
    "abonado" TEXT NOT NULL,
    "dni" TEXT,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "sector" TEXT,
    "celular" TEXT,
    "observacion" TEXT,
    "tecnicoId" TEXT,
    "fechaAsignacion" TIMESTAMP(3),
    "fechaAceptacion" TIMESTAMP(3),
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "tiempoInstalacion" INTEGER,
    "ipWan" TEXT,
    "mascara" TEXT,
    "gateway" TEXT,
    "pppoeUsuario" TEXT,
    "pppoePassword" TEXT,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "precinto" TEXT,
    "mensualidad" DECIMAL(10,2),
    "mbps" INTEGER,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orden_consumos" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_consumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "ruc" TEXT,
    "nombre" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "agencia" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metodos_pago_empresa" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoMetodoPago" NOT NULL,
    "numero" TEXT NOT NULL,
    "banco" TEXT,
    "titular" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metodos_pago_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egresos" (
    "id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egresos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_sesion_token_key" ON "tokens_sesion"("token");

-- CreateIndex
CREATE UNIQUE INDEX "tecnicos_dni_key" ON "tecnicos"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "tecnicos_email_key" ON "tecnicos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "secretarios_dni_key" ON "secretarios"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "secretarios_email_key" ON "secretarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_dniRuc_key" ON "clientes"("dniRuc");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_red_codigo_key" ON "puntos_red"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_ipWan_key" ON "contratos"("ipWan");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_pppoeUsuario_key" ON "contratos"("pppoeUsuario");

-- CreateIndex
CREATE INDEX "contratos_clienteId_idx" ON "contratos"("clienteId");

-- CreateIndex
CREATE INDEX "contratos_puntoRedId_idx" ON "contratos"("puntoRedId");

-- CreateIndex
CREATE INDEX "cargos_mensuales_contratoId_idx" ON "cargos_mensuales"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_mensuales_contratoId_periodo_key" ON "cargos_mensuales"("contratoId", "periodo");

-- CreateIndex
CREATE INDEX "pago_cargos_pagoId_idx" ON "pago_cargos"("pagoId");

-- CreateIndex
CREATE INDEX "pago_cargos_cargoId_idx" ON "pago_cargos"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_servicio_nServicio_key" ON "ordenes_servicio"("nServicio");

-- CreateIndex
CREATE INDEX "ordenes_servicio_contratoId_idx" ON "ordenes_servicio"("contratoId");

-- CreateIndex
CREATE INDEX "orden_consumos_ordenId_idx" ON "orden_consumos"("ordenId");

-- CreateIndex
CREATE INDEX "metodos_pago_empresa_empresaId_idx" ON "metodos_pago_empresa"("empresaId");

-- CreateIndex
CREATE INDEX "egresos_fecha_idx" ON "egresos"("fecha");

-- AddForeignKey
ALTER TABLE "tokens_sesion" ADD CONSTRAINT "tokens_sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_puntoRedId_fkey" FOREIGN KEY ("puntoRedId") REFERENCES "puntos_red"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_equipoProductoId_fkey" FOREIGN KEY ("equipoProductoId") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tecnicoInstaladorId_fkey" FOREIGN KEY ("tecnicoInstaladorId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos_mensuales" ADD CONSTRAINT "cargos_mensuales_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cargos" ADD CONSTRAINT "pago_cargos_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cargos" ADD CONSTRAINT "pago_cargos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos_mensuales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_consumos" ADD CONSTRAINT "orden_consumos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_consumos" ADD CONSTRAINT "orden_consumos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metodos_pago_empresa" ADD CONSTRAINT "metodos_pago_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
