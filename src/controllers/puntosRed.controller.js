const prisma = require('../utils/prisma');

const TIPOS_VALIDOS = ['NAP', 'CTO'];
const ESTADOS_VALIDOS = ['ACTIVA', 'SATURADA', 'MANTENIMIENTO'];

// GET /api/puntos-red
async function listar(req, res) {
  try {
    const data = await prisma.puntoRed.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (err) {
    console.error('Error en puntosRed.listar:', err);
    res.status(500).json({ error: 'Error al listar los puntos de red' });
  }
}

function validarPayload(body) {
  const { tipo, codigo, latitud, longitud, capacidad, ocupados, estado } = body;

  if (!TIPOS_VALIDOS.includes(tipo)) return 'Tipo inválido (debe ser NAP o CTO)';
  if (!codigo?.trim()) return 'El código es requerido';
  if (latitud === undefined || latitud === '' || longitud === undefined || longitud === '') return 'Faltan las coordenadas';
  if (Number.isNaN(Number(latitud)) || Number.isNaN(Number(longitud))) return 'Coordenadas inválidas';
  if (estado && !ESTADOS_VALIDOS.includes(estado)) return 'Estado inválido';
  if (capacidad !== undefined && capacidad !== '' && Number.isNaN(Number(capacidad))) return 'Capacidad inválida';
  if (ocupados !== undefined && ocupados !== '' && Number.isNaN(Number(ocupados))) return 'Ocupados inválido';
  return null;
}

// POST /api/puntos-red
async function crear(req, res) {
  try {
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const { tipo, codigo, latitud, longitud, capacidad, ocupados, estado, direccion, notas } = req.body;

    const punto = await prisma.puntoRed.create({
      data: {
        tipo,
        codigo: codigo.trim().toUpperCase(),
        latitud: Number(latitud),
        longitud: Number(longitud),
        capacidad: capacidad !== '' && capacidad !== undefined ? Number(capacidad) : null,
        ocupados: ocupados !== '' && ocupados !== undefined ? Number(ocupados) : 0,
        estado: estado || 'ACTIVA',
        direccion: direccion?.trim() || null,
        notas: notas?.trim() || null,
      },
    });

    res.status(201).json(punto);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un punto de red con ese código' });
    }
    console.error('Error en puntosRed.crear:', err);
    res.status(500).json({ error: 'Error al crear el punto de red' });
  }
}

// PUT /api/puntos-red/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const { tipo, codigo, latitud, longitud, capacidad, ocupados, estado, direccion, notas } = req.body;

    const punto = await prisma.puntoRed.update({
      where: { id },
      data: {
        tipo,
        codigo: codigo.trim().toUpperCase(),
        latitud: Number(latitud),
        longitud: Number(longitud),
        capacidad: capacidad !== '' && capacidad !== undefined ? Number(capacidad) : null,
        ocupados: ocupados !== '' && ocupados !== undefined ? Number(ocupados) : 0,
        estado: estado || 'ACTIVA',
        direccion: direccion?.trim() || null,
        notas: notas?.trim() || null,
      },
    });

    res.json(punto);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Punto de red no encontrado' });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un punto de red con ese código' });
    }
    console.error('Error en puntosRed.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el punto de red' });
  }
}

// DELETE /api/puntos-red/:id
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    await prisma.puntoRed.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Punto de red no encontrado' });
    }
    console.error('Error en puntosRed.eliminar:', err);
    res.status(500).json({ error: 'Error al eliminar el punto de red' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };
