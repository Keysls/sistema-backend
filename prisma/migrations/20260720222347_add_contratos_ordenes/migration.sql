-- CreateEnum
CREATE TYPE "TipoServicio" AS ENUM ('INTERNET', 'CABLE', 'DUO');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'CORTADO', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoOrden" AS ENUM ('PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoOrden" AS ENUM ('INSTALACION_I', 'ALTA_SERVICIO_I', 'ATENCION_NOC_I', 'AVERIA_I', 'BAJA_SERVICIO_I', 'CAMBIO_CONTRASENA_I', 'CAMBIO_DOMICILIO_I', 'CAMBIO_EQUIPO_I', 'CAMBIO_PLAN_I', 'CAMBIO_TITULAR_I', 'CORTE_SOLICITUD_I', 'CORTE_DEUDA_I', 'RECONEXION_I', 'RETIRO_EQUIPO_I', 'TRASLADO_I', 'INSTALACION_C', 'ALTA_SERVICIO_C', 'AVERIA_C', 'CAMBIO_DOMICILIO_C', 'CAMBIO_PLAN_C', 'CAMBIO_TITULAR_C', 'CORTE_SOLICITUD_C', 'CORTE_DEUDA_C', 'INSTALACION_ANEXO_C', 'MIGRACION_FTTH_C', 'RECONEXION_C', 'RETIRO_EQUIPO_C', 'SUPERVISION_C', 'TRASLADO_C', 'INSTALACION_D', 'ALTA_SERVICIO_D', 'AVERIA_D', 'CAMBIO_DOMICILIO_D', 'CAMBIO_EQUIPO_D', 'CAMBIO_PLAN_D', 'CAMBIO_TITULAR_D', 'CORTE_SOLICITUD_D', 'CORTE_DEUDA_D', 'RECONEXION_D', 'RETIRO_EQUIPO_D', 'TRASLADO_D', 'BAJA_SERVICIO_D');

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
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
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "tiempoInstalacion" INTEGER,
    "ipWan" TEXT,
    "mascara" TEXT,
    "gateway" TEXT,
    "mensualidad" DECIMAL(10,2),
    "mbps" INTEGER,
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordenes_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");

-- CreateIndex
CREATE INDEX "contratos_clienteId_idx" ON "contratos"("clienteId");

-- CreateIndex
CREATE INDEX "contratos_puntoRedId_idx" ON "contratos"("puntoRedId");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_servicio_nServicio_key" ON "ordenes_servicio"("nServicio");

-- CreateIndex
CREATE INDEX "ordenes_servicio_contratoId_idx" ON "ordenes_servicio"("contratoId");

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
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_servicio" ADD CONSTRAINT "ordenes_servicio_planId_fkey" FOREIGN KEY ("planId") REFERENCES "planes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
