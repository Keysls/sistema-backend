-- AlterEnum
ALTER TYPE "EstadoCargo" ADD VALUE 'EXONERADO';

-- AlterTable
ALTER TABLE "cargos_mensuales" ADD COLUMN     "nota" TEXT;
