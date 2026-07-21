const prisma = require('../utils/prisma');

const INCLUDE_EGRESO = {
  usuario: { select: { id: true, nombre: true, apellido: true } },
};

// GET /api/egresos?fechaDesde=&fechaHasta=&categoria=
async function listar(req, res) {
  try {
    const { fechaDesde, fechaHasta, categoria } = req.query;
    const where = {
      ...(categoria ? { categoria } : {}),
      ...(fechaDesde || fechaHasta
        ? { fecha: { ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}), ...(fechaHasta ? { lte: new Date(fechaHasta + 'T23:59:59') } : {}) } }
        : {}),
    };
    const data = await prisma.egreso.findMany({ where, include: INCLUDE_EGRESO, orderBy: { fecha: 'desc' } });
    res.json(data);
  } catch (err) {
    console.error('Error en egresos.listar:', err);
    res.status(500).json({ error: 'Error al listar los egresos' });
  }
}

// POST /api/egresos
async function crear(req, res) {
  try {
    const { concepto, categoria, monto, fecha, observacion } = req.body;
    if (!concepto?.trim()) return res.status(400).json({ error: 'El concepto es requerido' });
    if (!fecha) return res.status(400).json({ error: 'La fecha es requerida' });
    if (!(Number(monto) > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const egreso = await prisma.egreso.create({
      data: {
        concepto: concepto.trim(),
        categoria: categoria?.trim() || null,
        monto: Number(monto),
        fecha: new Date(fecha),
        observacion: observacion?.trim() || null,
        usuarioId: req.usuario.id,
      },
      include: INCLUDE_EGRESO,
    });
    res.status(201).json(egreso);
  } catch (err) {
    console.error('Error en egresos.crear:', err);
    res.status(500).json({ error: 'Error al registrar el egreso' });
  }
}

// DELETE /api/egresos/:id
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    await prisma.egreso.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Egreso no encontrado' });
    console.error('Error en egresos.eliminar:', err);
    res.status(500).json({ error: 'Error al eliminar el egreso' });
  }
}

module.exports = { listar, crear, eliminar };
