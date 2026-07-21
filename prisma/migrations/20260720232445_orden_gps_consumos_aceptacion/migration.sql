-- AlterTable
ALTER TABLE "ordenes_servicio" ADD COLUMN     "fechaAceptacion" TIMESTAMP(3),
ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION,
ADD COLUMN     "precinto" TEXT;

-- CreateTable
CREATE TABLE "orden_consumos" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_consumos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orden_consumos_ordenId_idx" ON "orden_consumos"("ordenId");

-- AddForeignKey
ALTER TABLE "orden_consumos" ADD CONSTRAINT "orden_consumos_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "ordenes_servicio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orden_consumos" ADD CONSTRAINT "orden_consumos_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
