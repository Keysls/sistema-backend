const prisma = require('../utils/prisma');

// GET /api/productos/catalogo?q=&categoria=&page=&limit=
async function catalogo(req, res) {
  try {
    const { q, categoria, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const where = {
      ...(categoria ? { categoria } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { codigo: { contains: q, mode: 'insensitive' } },
              { descripcion: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.producto.count({ where }),
    ]);

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    console.error('Error en productos.catalogo:', err);
    res.status(500).json({ error: 'Error al listar el catálogo' });
  }
}

// GET /api/productos/categorias
async function categorias(req, res) {
  try {
    const rows = await prisma.producto.findMany({
      where: { categoria: { not: null } },
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' },
    });
    res.json(rows.map((r) => r.categoria));
  } catch (err) {
    console.error('Error en productos.categorias:', err);
    res.status(500).json({ error: 'Error al listar categorías' });
  }
}

// POST /api/productos
async function crear(req, res) {
  try {
    const { nombre, codigo, categoria, unidad, descripcion, es_medible, metros_por_unidad, tiene_variantes } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const ultimo = await prisma.producto.findFirst({ orderBy: { id: 'desc' } });
    const nuevoId = (ultimo?.id || 0) + 1;

    const producto = await prisma.producto.create({
      data: {
        id: nuevoId,
        nombre: nombre.trim(),
        codigo: codigo || null,
        categoria: categoria || null,
        unidad: unidad || null,
        descripcion: descripcion || null,
        esMedible: Boolean(es_medible),
        metrosPorUnidad: metros_por_unidad ? Number(metros_por_unidad) : null,
        tieneVariantes: Boolean(tiene_variantes),
      },
    });

    res.status(201).json(producto);
  } catch (err) {
    console.error('Error en productos.crear:', err);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
}

// PUT /api/productos/:id
async function actualizar(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { nombre, codigo, categoria, unidad, descripcion, es_medible, metros_por_unidad, tiene_variantes } = req.body;

    const producto = await prisma.producto.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        codigo: codigo || null,
        categoria: categoria || null,
        unidad: unidad || null,
        descripcion: descripcion || null,
        esMedible: Boolean(es_medible),
        metrosPorUnidad: metros_por_unidad ? Number(metros_por_unidad) : null,
        tieneVariantes: Boolean(tiene_variantes),
      },
    });

    res.json(producto);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    console.error('Error en productos.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
}

// GET /api/productos/:productoId/variantes
async function variantes(req, res) {
  try {
    const productoId = parseInt(req.params.productoId, 10);
    const data = await prisma.productoVariante.findMany({
      where: { productoId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(data);
  } catch (err) {
    console.error('Error en productos.variantes:', err);
    res.status(500).json({ error: 'Error al listar variantes' });
  }
}

// POST /api/productos/:productoId/variantes
async function crearVariante(req, res) {
  try {
    const productoId = parseInt(req.params.productoId, 10);
    const { genero, talla, codigo } = req.body;

    const variante = await prisma.productoVariante.create({
      data: { productoId, genero: genero || null, talla: talla || null, codigo: codigo || null },
    });

    res.status(201).json(variante);
  } catch (err) {
    console.error('Error en productos.crearVariante:', err);
    res.status(500).json({ error: 'Error al crear la variante' });
  }
}

// PUT /api/productos/variantes/:varianteId
async function actualizarVariante(req, res) {
  try {
    const { varianteId } = req.params;
    const { genero, talla, codigo } = req.body;

    const variante = await prisma.productoVariante.update({
      where: { id: varianteId },
      data: { genero: genero || null, talla: talla || null, codigo: codigo || null },
    });

    res.json(variante);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Variante no encontrada' });
    }
    console.error('Error en productos.actualizarVariante:', err);
    res.status(500).json({ error: 'Error al actualizar la variante' });
  }
}

// DELETE /api/productos/variantes/:varianteId
async function eliminarVariante(req, res) {
  try {
    const { varianteId } = req.params;
    await prisma.productoVariante.delete({ where: { id: varianteId } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Variante no encontrada' });
    }
    console.error('Error en productos.eliminarVariante:', err);
    res.status(500).json({ error: 'Error al eliminar la variante' });
  }
}

module.exports = {
  catalogo,
  categorias,
  crear,
  actualizar,
  variantes,
  crearVariante,
  actualizarVariante,
  eliminarVariante,
};