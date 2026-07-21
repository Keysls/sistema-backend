const prisma = require('../utils/prisma');

const TIPOS_VALIDOS = ['INTERNET', 'CABLE', 'DUO'];

// GET /api/planes?tipoServicio=&soloActivos=
async function listar(req, res) {
  try {
    const { tipoServicio, soloActivos } = req.query;
    const where = {
      ...(tipoServicio ? { tipoServicio } : {}),
      ...(soloActivos === 'true' ? { activo: true } : {}),
    };
    const data = await prisma.plan.findMany({ where, orderBy: [{ tipoServicio: 'asc' }, { mbps: 'asc' }] });
    res.json(data);
  } catch (err) {
    console.error('Error en planes.listar:', err);
    res.status(500).json({ error: 'Error al listar los planes' });
  }
}

// POST /api/planes
async function crear(req, res) {
  try {
    const { nombre, tipoServicio, mbps, precio } = req.body;

    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!TIPOS_VALIDOS.includes(tipoServicio)) return res.status(400).json({ error: 'Tipo de servicio inválido' });
    if (precio === undefined || precio === '' || Number.isNaN(Number(precio))) return res.status(400).json({ error: 'El precio es requerido y debe ser numérico' });

    const plan = await prisma.plan.create({
      data: {
        nombre: nombre.trim(),
        tipoServicio,
        mbps: mbps !== '' && mbps !== undefined ? Number(mbps) : null,
        precio: Number(precio),
      },
    });

    res.status(201).json(plan);
  } catch (err) {
    console.error('Error en planes.crear:', err);
    res.status(500).json({ error: 'Error al crear el plan' });
  }
}

// PUT /api/planes/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, tipoServicio, mbps, precio, activo } = req.body;

    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!TIPOS_VALIDOS.includes(tipoServicio)) return res.status(400).json({ error: 'Tipo de servicio inválido' });
    if (precio === undefined || precio === '' || Number.isNaN(Number(precio))) return res.status(400).json({ error: 'El precio es requerido y debe ser numérico' });

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        nombre: nombre.trim(),
        tipoServicio,
        mbps: mbps !== '' && mbps !== undefined ? Number(mbps) : null,
        precio: Number(precio),
        ...(activo !== undefined ? { activo: Boolean(activo) } : {}),
      },
    });

    res.json(plan);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Plan no encontrado' });
    console.error('Error en planes.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el plan' });
  }
}

module.exports = { listar, crear, actualizar };
