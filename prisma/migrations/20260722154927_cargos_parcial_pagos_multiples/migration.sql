-- AlterEnum
ALTER TYPE "EstadoCargo" ADD VALUE 'PARCIAL';

-- DropIndex
DROP INDEX "pago_cargos_cargoId_key";

-- CreateIndex
CREATE INDEX "pago_cargos_cargoId_idx" ON "pago_cargos"("cargoId");
