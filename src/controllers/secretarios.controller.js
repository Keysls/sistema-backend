const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');

function sanitizar(secretario) {
  const { password, ...resto } = secretario;
  return resto;
}

// GET /api/secretarios
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

    const secretarios = await prisma.secretario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(secretarios.map(sanitizar));
  } catch (err) {
    console.error('Error en secretarios.listar:', err);
    res.status(500).json({ error: 'Error al listar secretarios' });
  }
}

// POST /api/secretarios
async function crear(req, res) {
  try {
    const { nombre, apellido, dni, telefono, email, password } = req.body;

    if (!nombre?.trim() || !apellido?.trim() || !dni?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Nombre, apellido, DNI, email y contraseña son requeridos' });
    }

    const yaExiste = await prisma.secretario.findFirst({
      where: { OR: [{ dni: dni.trim() }, { email: email.toLowerCase().trim() }] },
    });
    if (yaExiste) {
      return res.status(409).json({ error: 'Ya existe un secretario con ese DNI o email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const secretario = await prisma.secretario.create({
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        telefono: telefono || null,
        email: email.toLowerCase().trim(),
        password: passwordHash,
      },
    });

    res.status(201).json(sanitizar(secretario));
  } catch (err) {
    console.error('Error en secretarios.crear:', err);
    res.status(500).json({ error: 'Error al crear el secretario' });
  }
}

// PUT /api/secretarios/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const { nombre, apellido, dni, telefono, email, password, activo } = req.body;

    const data = {
      nombre: nombre?.trim(),
      apellido: apellido?.trim(),
      dni: dni?.trim(),
      telefono: telefono || null,
      email: email?.toLowerCase().trim(),
      ...(activo !== undefined ? { activo: Boolean(activo) } : {}),
    };

    if (password?.trim()) {
      data.password = await bcrypt.hash(password, 10);
    }

    const secretario = await prisma.secretario.update({ where: { id }, data });
    res.json(sanitizar(secretario));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Secretario no encontrado' });
    }
    console.error('Error en secretarios.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el secretario' });
  }
}

// DELETE /api/secretarios/:id
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    await prisma.secretario.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Secretario no encontrado' });
    }
    console.error('Error en secretarios.eliminar:', err);
    res.status(500).json({ error: 'Error al eliminar el secretario' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };