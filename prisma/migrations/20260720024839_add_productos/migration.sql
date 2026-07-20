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
CREATE TABLE "producto_variantes" (
    "id" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "genero" TEXT,
    "talla" TEXT,
    "codigo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
