const prisma = require('../utils/prisma');

// GET /api/inventario/movimientos?tipo=&q=&page=&limit=
async function listarMovimientos(req, res) {
  try {
    const { tipo, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const where = tipo ? { tipo } : {};

    const [data, total] = await Promise.all([
      prisma.movimientoStock.findMany({
        where,
        include: { producto: { select: { nombre: true, codigo: true, unidad: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.movimientoStock.count({ where }),
    ]);

    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    console.error('Error en inventario.listarMovimientos:', err);
    res.status(500).json({ error: 'Error al listar movimientos' });
  }
}

// GET /api/inventario/movimientos/todos  (sin paginar, para exportar a Excel)
async function listarMovimientosTodos(req, res) {
  try {
    const { tipo } = req.query;
    const where = tipo ? { tipo } : {};

    const data = await prisma.movimientoStock.findMany({
      where,
      include: { producto: { select: { nombre: true, codigo: true, unidad: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(data);
  } catch (err) {
    console.error('Error en inventario.listarMovimientosTodos:', err);
    res.status(500).json({ error: 'Error al listar movimientos' });
  }
}

// Convierte una fecha 'YYYY-MM-DD' (elegida por el usuario) en un Date válido,
// conservando la hora actual. Si no viene o es inválida, usa el momento actual.
function resolverFecha(fecha) {
  if (!fecha) return new Date();
  const ahora = new Date();
  const partes = String(fecha).split('-').map(Number);
  if (partes.length !== 3 || partes.some(isNaN)) return new Date();
  const [anio, mes, dia] = partes;
  const resultado = new Date(anio, mes - 1, dia, ahora.getHours(), ahora.getMinutes(), ahora.getSeconds());
  return isNaN(resultado.getTime()) ? new Date() : resultado;
}

// POST /api/inventario/entradas
async function registrarEntrada(req, res) {
  try {
    const { productoId, cantidad, proveedor, motivo, fecha } = req.body;
    const prodId = parseInt(productoId, 10);
    const cantidadNum = parseInt(cantidad, 10);

    if (!prodId || !cantidadNum || cantidadNum <= 0) {
      return res.status(400).json({ error: 'Selecciona un producto y una cantidad válida' });
    }

    const producto = await prisma.producto.findUnique({ where: { id: prodId } });
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoStock.create({
        data: {
          productoId: prodId,
          tipo: 'ENTRADA',
          cantidad: cantidadNum,
          proveedor: proveedor || null,
          motivo: motivo || null,
          createdAt: resolverFecha(fecha),
        },
        include: { producto: { select: { nombre: true, codigo: true, unidad: true } } },
      }),
      prisma.producto.update({
        where: { id: prodId },
        data: {
          stockTotal: { increment: cantidadNum },
          ...(producto.esMedible && producto.metrosPorUnidad
            ? { metrosDisponibles: { increment: cantidadNum * producto.metrosPorUnidad } }
            : {}),
        },
      }),
    ]);

    res.status(201).json(movimiento);
  } catch (err) {
    console.error('Error en inventario.registrarEntrada:', err);
    res.status(500).json({ error: 'Error al registrar la entrada' });
  }
}

// POST /api/inventario/salidas
async function registrarSalida(req, res) {
  try {
    const { productoId, cantidad, motivo, fecha } = req.body;
    const prodId = parseInt(productoId, 10);
    const cantidadNum = parseInt(cantidad, 10);

    if (!prodId || !cantidadNum || cantidadNum <= 0) {
      return res.status(400).json({ error: 'Selecciona un producto y una cantidad válida' });
    }
    if (!motivo?.trim()) {
      return res.status(400).json({ error: 'El motivo es requerido' });
    }

    const producto = await prisma.producto.findUnique({ where: { id: prodId } });
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (producto.stockTotal < cantidadNum) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${producto.stockTotal}` });
    }

    const [movimiento] = await prisma.$transaction([
      prisma.movimientoStock.create({
        data: {
          productoId: prodId,
          tipo: 'SALIDA',
          cantidad: cantidadNum,
          motivo: motivo.trim(),
          createdAt: resolverFecha(fecha),
        },
        include: { producto: { select: { nombre: true, codigo: true, unidad: true } } },
      }),
      prisma.producto.update({
        where: { id: prodId },
        data: {
          stockTotal: { decrement: cantidadNum },
          ...(producto.esMedible && producto.metrosPorUnidad
            ? { metrosDisponibles: { decrement: Math.min(cantidadNum * producto.metrosPorUnidad, producto.metrosDisponibles || 0) } }
            : {}),
        },
      }),
    ]);

    res.status(201).json(movimiento);
  } catch (err) {
    console.error('Error en inventario.registrarSalida:', err);
    res.status(500).json({ error: 'Error al registrar la salida' });
  }
}

// GET /api/inventario/productos  (solo productos con al menos un movimiento registrado)
async function listarProductosConMovimiento(req, res) {
  try {
    const { q } = req.query;

    const where = {
      movimientos: { some: {} },
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { codigo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const productos = await prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });

    res.json(productos);
  } catch (err) {
    console.error('Error en inventario.listarProductosConMovimiento:', err);
    res.status(500).json({ error: 'Error al listar productos del inventario' });
  }
}

// GET /api/inventario/stats  (resumen para el dashboard de almacén)
async function stats(req, res) {
  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    // Solo contamos productos que efectivamente están gestionados en el almacén
    // (tienen al menos un movimiento registrado), no el catálogo completo.
    const [agregados, movimientosHoy, productos, ultimasSalidas] = await Promise.all([
      prisma.producto.aggregate({
        where: { movimientos: { some: {} } },
        _sum: { stockTotal: true },
        _count: { _all: true },
      }),
      prisma.movimientoStock.count({ where: { createdAt: { gte: inicioDia } } }),
      // Prisma no soporta comparar dos columnas en `where`, así que traemos los
      // productos activos con movimiento y filtramos el stock bajo en memoria.
      prisma.producto.findMany({
        where: { estado: true, movimientos: { some: {} } },
        select: { id: true, nombre: true, codigo: true, stockTotal: true, stockMinimo: true },
      }),
      prisma.movimientoStock.findMany({
        where: { tipo: 'SALIDA' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { producto: { select: { nombre: true, codigo: true } } },
      }),
    ]);

    const bajoStock = productos
      .filter(p => p.stockMinimo > 0 && p.stockTotal <= p.stockMinimo)
      .sort((a, b) => a.stockTotal - b.stockTotal);

    res.json({
      itemsEnSede: agregados._sum.stockTotal || 0,
      totalProductos: agregados._count._all || 0,
      movimientosHoy,
      stockBajo: bajoStock.map(p => ({ nombre: p.nombre, codigo: p.codigo, stock: p.stockTotal, minimo: p.stockMinimo })),
      ultimasSalidas: ultimasSalidas.map(m => ({
        item: m.producto?.nombre || '—',
        codigo: m.producto?.codigo || null,
        cantidad: m.cantidad,
        fecha: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('Error en inventario.stats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas del almacén' });
  }
}

module.exports = { listarMovimientos, listarMovimientosTodos, registrarEntrada, registrarSalida, listarProductosConMovimiento, stats };