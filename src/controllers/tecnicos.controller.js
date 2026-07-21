const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

function sanitizar(tecnico) {
  const { password, ...resto } = tecnico;
  return resto;
}

// GET /api/tecnicos
async function listar(req, res) {
  try {
    const { q } = req.query;

    const where = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { apellido: { contains: q, mode: 'insensitive' } },
            { dni: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const tecnicos = await prisma.tecnico.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(tecnicos.map(sanitizar));
  } catch (err) {
    console.error('Error en tecnicos.listar:', err);
    res.status(500).json({ error: 'Error al listar técnicos' });
  }
}

// POST /api/tecnicos
async function crear(req, res) {
  try {
    const { nombre, apellido, dni, telefono, email, password, zona, vehiculo } = req.body;

    if (!nombre?.trim() || !apellido?.trim() || !dni?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Nombre, apellido, DNI, email y contraseña son requeridos' });
    }

    const yaExiste = await prisma.tecnico.findFirst({
      where: { OR: [{ dni: dni.trim() }, { email: email.toLowerCase().trim() }] },
    });
    if (yaExiste) {
      return res.status(409).json({ error: 'Ya existe un técnico con ese DNI o email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const tecnico = await prisma.tecnico.create({
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        telefono: telefono || null,
        email: email.toLowerCase().trim(),
        password: passwordHash,
        zona: zona || null,
        vehiculo: vehiculo || null,
      },
    });

    res.status(201).json(sanitizar(tecnico));
  } catch (err) {
    console.error('Error en tecnicos.crear:', err);
    res.status(500).json({ error: 'Error al crear el técnico' });
  }
}

// PUT /api/tecnicos/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, apellido, dni, telefono, email, password, zona, vehiculo, activo } = req.body;

    const data = {
      nombre: nombre?.trim(),
      apellido: apellido?.trim(),
      dni: dni?.trim(),
      telefono: telefono || null,
      email: email?.toLowerCase().trim(),
      zona: zona || null,
      vehiculo: vehiculo || null,
      ...(activo !== undefined ? { activo: Boolean(activo) } : {}),
    };

    if (password?.trim()) {
      data.password = await bcrypt.hash(password, 10);
    }

    const tecnico = await prisma.tecnico.update({ where: { id }, data });
    res.json(sanitizar(tecnico));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Técnico no encontrado' });
    }
    console.error('Error en tecnicos.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el técnico' });
  }
}

// DELETE /api/tecnicos/:id
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    await prisma.tecnico.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Técnico no encontrado' });
    }
    console.error('Error en tecnicos.eliminar:', err);
    res.status(500).json({ error: 'Error al eliminar el técnico' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };