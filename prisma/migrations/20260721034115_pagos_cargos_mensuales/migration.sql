-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('PENDIENTE', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA');

-- CreateTable
CREATE TABLE "cargos_mensuales" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'PENDIENTE',
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

-- CreateIndex
CREATE INDEX "cargos_mensuales_contratoId_idx" ON "cargos_mensuales"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "cargos_mensuales_contratoId_periodo_key" ON "cargos_mensuales"("contratoId", "periodo");

-- CreateIndex
CREATE INDEX "pago_cargos_pagoId_idx" ON "pago_cargos"("pagoId");

-- CreateIndex
CREATE UNIQUE INDEX "pago_cargos_cargoId_key" ON "pago_cargos"("cargoId");

-- AddForeignKey
ALTER TABLE "cargos_mensuales" ADD CONSTRAINT "cargos_mensuales_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cargos" ADD CONSTRAINT "pago_cargos_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_cargos" ADD CONSTRAINT "pago_cargos_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos_mensuales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
