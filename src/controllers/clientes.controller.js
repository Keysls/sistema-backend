const prisma = require('../utils/prisma');

function parseCoord(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// GET /api/clientes?q=
async function listar(req, res) {
  try {
    const { q } = req.query;
    const where = q
      ? {
          OR: [
            { nombres: { contains: q, mode: 'insensitive' } },
            { apellidos: { contains: q, mode: 'insensitive' } },
            { dniRuc: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const data = await prisma.cliente.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (err) {
    console.error('Error en clientes.listar:', err);
    res.status(500).json({ error: 'Error al listar clientes' });
  }
}

// POST /api/clientes
async function crear(req, res) {
  try {
    const { dniRuc, nombres, apellidos, telefono, email, direccion, latitud, longitud } = req.body;

    if (!dniRuc?.trim() || !/^\d{8}(\d{3})?$/.test(dniRuc.trim())) {
      return res.status(400).json({ error: 'El DNI (8 dígitos) o RUC (11 dígitos) es requerido y debe ser válido' });
    }
    if (!nombres?.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const cliente = await prisma.cliente.create({
      data: {
        dniRuc: dniRuc.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos?.trim() || null,
        telefono: telefono?.trim() || null,
        email: email?.trim() || null,
        direccion: direccion?.trim() || null,
        latitud: parseCoord(latitud),
        longitud: parseCoord(longitud),
      },
    });

    res.status(201).json(cliente);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con ese DNI/RUC' });
    }
    console.error('Error en clientes.crear:', err);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
}

// PUT /api/clientes/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { dniRuc, nombres, apellidos, telefono, email, direccion, activo, latitud, longitud } = req.body;

    if (!nombres?.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(dniRuc ? { dniRuc: dniRuc.trim() } : {}),
        nombres: nombres.trim(),
        apellidos: apellidos?.trim() || null,
        telefono: telefono?.trim() || null,
        email: email?.trim() || null,
        direccion: direccion?.trim() || null,
        latitud: parseCoord(latitud),
        longitud: parseCoord(longitud),
        ...(activo !== undefined ? { activo: Boolean(activo) } : {}),
      },
    });

    res.json(cliente);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un cliente registrado con ese DNI/RUC' });
    }
    console.error('Error en clientes.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
}

module.exports = { listar, crear, actualizar };
