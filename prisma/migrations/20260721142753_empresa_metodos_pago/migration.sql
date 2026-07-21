-- CreateEnum
CREATE TYPE "TipoMetodoPago" AS ENUM ('YAPE', 'PLIN', 'CUENTA_BANCARIA');

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "ruc" TEXT,
    "nombre" TEXT,
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

-- CreateIndex
CREATE INDEX "metodos_pago_empresa_empresaId_idx" ON "metodos_pago_empresa"("empresaId");

-- AddForeignKey
ALTER TABLE "metodos_pago_empresa" ADD CONSTRAINT "metodos_pago_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
