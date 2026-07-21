const prisma = require('../utils/prisma');

const TIPOS_VALIDOS = ['YAPE', 'PLIN', 'CUENTA_BANCARIA'];

async function obtenerOCrear() {
  let empresa = await prisma.empresa.findFirst({ include: { metodosPago: { orderBy: { createdAt: 'asc' } } } });
  if (!empresa) {
    empresa = await prisma.empresa.create({ data: {}, include: { metodosPago: true } });
  }
  return empresa;
}

// GET /api/empresa
async function obtener(req, res) {
  try {
    const empresa = await obtenerOCrear();
    res.json(empresa);
  } catch (err) {
    console.error('Error en empresa.obtener:', err);
    res.status(500).json({ error: 'Error al obtener los datos de la empresa' });
  }
}

// PUT /api/empresa
async function actualizar(req, res) {
  try {
    const { ruc, nombre, direccion, telefono, agencia, logo } = req.body;
    const empresa = await obtenerOCrear();
    const actualizada = await prisma.empresa.update({
      where: { id: empresa.id },
      data: {
        ruc: ruc?.trim() || null,
        nombre: nombre?.trim() || null,
        direccion: direccion?.trim() || null,
        telefono: telefono?.trim() || null,
        agencia: agencia?.trim() || null,
        ...(logo !== undefined ? { logo: logo || null } : {}),
      },
      include: { metodosPago: { orderBy: { createdAt: 'asc' } } },
    });
    res.json(actualizada);
  } catch (err) {
    console.error('Error en empresa.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar los datos de la empresa' });
  }
}

// POST /api/empresa/metodos
async function agregarMetodo(req, res) {
  try {
    const { tipo, numero, banco, titular } = req.body;
    if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de método de pago inválido' });
    if (!numero?.trim()) return res.status(400).json({ error: 'El número es requerido' });

    const empresa = await obtenerOCrear();
    const metodo = await prisma.metodoPagoEmpresa.create({
      data: { empresaId: empresa.id, tipo, numero: numero.trim(), banco: banco?.trim() || null, titular: titular?.trim() || null },
    });
    res.status(201).json(metodo);
  } catch (err) {
    console.error('Error en empresa.agregarMetodo:', err);
    res.status(500).json({ error: 'Error al agregar el método de pago' });
  }
}

// PUT /api/empresa/metodos/:id
async function actualizarMetodo(req, res) {
  try {
    const { id } = req.params;
    const { tipo, numero, banco, titular } = req.body;
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de método de pago inválido' });

    const metodo = await prisma.metodoPagoEmpresa.update({
      where: { id },
      data: {
        ...(tipo ? { tipo } : {}),
        ...(numero !== undefined ? { numero: numero.trim() } : {}),
        banco: banco?.trim() || null,
        titular: titular?.trim() || null,
      },
    });
    res.json(metodo);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Método de pago no encontrado' });
    console.error('Error en empresa.actualizarMetodo:', err);
    res.status(500).json({ error: 'Error al actualizar el método de pago' });
  }
}

// DELETE /api/empresa/metodos/:id
async function eliminarMetodo(req, res) {
  try {
    const { id } = req.params;
    await prisma.metodoPagoEmpresa.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Método de pago no encontrado' });
    console.error('Error en empresa.eliminarMetodo:', err);
    res.status(500).json({ error: 'Error al eliminar el método de pago' });
  }
}

module.exports = { obtener, actualizar, agregarMetodo, actualizarMetodo, eliminarMetodo };
