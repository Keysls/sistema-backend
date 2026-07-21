-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MetodoPago" ADD VALUE 'YAPE';
ALTER TYPE "MetodoPago" ADD VALUE 'PLIN';

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
CREATE INDEX "egresos_fecha_idx" ON "egresos"("fecha");

-- AddForeignKey
ALTER TABLE "egresos" ADD CONSTRAINT "egresos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
