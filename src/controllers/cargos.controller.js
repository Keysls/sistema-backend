const prisma = require('../utils/prisma');
const { generarCargosDelMes, previsualizarCargosDelMes, estaVencido, mesesSaltadosPorCorte, generarCargosSaltados, aplicarDescuentoMasivo, quitarDescuentoMasivo } = require('../utils/generarCargos');

// GET /api/cargos/contrato/:contratoId  (deuda pendiente de un contrato)
async function listarPorContrato(req, res) {
  try {
    const { contratoId } = req.params;
    const [cargos, contrato] = await Promise.all([
      prisma.cargoMensual.findMany({
        where: { contratoId, estado: { in: ['PENDIENTE', 'PARCIAL'] } },
        include: { pagos: { select: { monto: true } } },
        orderBy: { periodo: 'asc' },
      }),
      prisma.contrato.findUnique({ where: { id: contratoId }, select: { diaCorte: true } }),
    ]);
    const data = cargos.map(({ pagos, ...c }) => {
      const pagado = pagos.reduce((s, p) => s + Number(p.monto), 0);
      return { ...c, saldo: Number(c.monto) - pagado, vencido: estaVencido(c.periodo, contrato?.diaCorte) };
    });
    res.json(data);
  } catch (err) {
    console.error('Error en cargos.listarPorContrato:', err);
    res.status(500).json({ error: 'Error al listar la deuda del contrato' });
  }
}

// GET /api/cargos/preview  (contratos que recibirían cargo si se genera ahora)
async function previsualizar(req, res) {
  try {
    const resultado = await previsualizarCargosDelMes();
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.previsualizar:', err);
    res.status(500).json({ error: 'Error al previsualizar los cargos del mes' });
  }
}

// POST /api/cargos/generar  (manual, respaldo del cron diario)
async function generarManual(req, res) {
  try {
    const { exonerarIds, descuentos } = req.body || {};
    const resultado = await generarCargosDelMes({ exonerarIds, descuentos });
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.generarManual:', err);
    res.status(500).json({ error: 'Error al generar los cargos del mes' });
  }
}

// POST /api/cargos  (generar deuda manualmente para un contrato/período específico)
async function crearManual(req, res) {
  try {
    const { contratoId, periodo, monto, vencimiento } = req.body;

    if (!contratoId) return res.status(400).json({ error: 'El contrato es requerido' });
    if (!/^\d{4}-\d{2}$/.test(periodo || '')) return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    if (!(Number(monto) > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const contrato = await prisma.contrato.findUnique({ where: { id: contratoId } });
    if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado' });

    const existente = await prisma.cargoMensual.findUnique({
      where: { contratoId_periodo: { contratoId, periodo } },
    });
    if (existente) return res.status(409).json({ error: `Ya existe un cargo para el período ${periodo} en este contrato` });

    const [anio, mes] = periodo.split('-').map(Number);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const diaVencimiento = Math.min(contrato.diaCorte || diasEnMes, diasEnMes);

    const cargo = await prisma.cargoMensual.create({
      data: {
        contratoId,
        periodo,
        monto: Number(monto),
        vencimiento: vencimiento ? new Date(vencimiento) : new Date(anio, mes - 1, diaVencimiento),
        estado: 'PENDIENTE',
      },
    });
    res.status(201).json(cargo);
  } catch (err) {
    console.error('Error en cargos.crearManual:', err);
    res.status(500).json({ error: 'Error al generar el cargo' });
  }
}

// PATCH /api/cargos/:id/descuento  (aplica o CAMBIA el % de descuento de un cargo pendiente).
// Siempre calcula desde el monto ORIGINAL (guardado la primera vez), así que aplicar
// 10% y luego 20% da el resultado correcto y no va descontando en cascada.
async function aplicarDescuento(req, res) {
  try {
    const { id } = req.params;
    const { porcentaje } = req.body;
    const pct = Number(porcentaje);

    if (!(pct > 0 && pct <= 100)) return res.status(400).json({ error: 'El porcentaje debe estar entre 1 y 100' });

    const cargo = await prisma.cargoMensual.findUnique({ where: { id } });
    if (!cargo) return res.status(404).json({ error: 'Cargo no encontrado' });
    if (cargo.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se puede aplicar un descuento a un cargo pendiente sin abonos' });
    }

    const base = cargo.montoOriginal != null ? Number(cargo.montoOriginal) : Number(cargo.monto);
    const nuevoMonto = Math.round(base * (1 - pct / 100) * 100) / 100;
    const cargoActualizado = await prisma.cargoMensual.update({
      where: { id },
      data: { monto: nuevoMonto, montoOriginal: base, nota: `Descuento ${pct}% aplicado manualmente` },
    });

    res.json(cargoActualizado);
  } catch (err) {
    console.error('Error en cargos.aplicarDescuento:', err);
    res.status(500).json({ error: 'Error al aplicar el descuento' });
  }
}

// DELETE /api/cargos/:id/descuento  (quita el descuento y regresa al monto original)
async function quitarDescuento(req, res) {
  try {
    const { id } = req.params;
    const cargo = await prisma.cargoMensual.findUnique({ where: { id } });
    if (!cargo) return res.status(404).json({ error: 'Cargo no encontrado' });
    if (cargo.montoOriginal == null) return res.status(400).json({ error: 'Este cargo no tiene ningún descuento aplicado' });

    const cargoActualizado = await prisma.cargoMensual.update({
      where: { id },
      data: { monto: cargo.montoOriginal, montoOriginal: null, nota: null },
    });

    res.json(cargoActualizado);
  } catch (err) {
    console.error('Error en cargos.quitarDescuento:', err);
    res.status(500).json({ error: 'Error al quitar el descuento' });
  }
}

// GET /api/cargos/descuento-masivo/preview?periodo=YYYY-MM  (cuántos cargos se verían afectados)
async function previsualizarDescuentoMasivo(req, res) {
  try {
    const { periodo } = req.query;
    if (!/^\d{4}-\d{2}$/.test(periodo || '')) return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    const [cantidad, cantidadConDescuento] = await Promise.all([
      prisma.cargoMensual.count({ where: { periodo, estado: 'PENDIENTE' } }),
      prisma.cargoMensual.count({ where: { periodo, estado: 'PENDIENTE', montoOriginal: { not: null } } }),
    ]);
    res.json({ periodo, cantidad, cantidadConDescuento });
  } catch (err) {
    console.error('Error en cargos.previsualizarDescuentoMasivo:', err);
    res.status(500).json({ error: 'Error al previsualizar el descuento masivo' });
  }
}

// POST /api/cargos/descuento-masivo  { periodo, porcentaje, motivo? }
async function descuentoMasivo(req, res) {
  try {
    const { periodo, porcentaje, motivo } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(periodo || '')) return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    const pct = Number(porcentaje);
    if (!(pct > 0 && pct <= 100)) return res.status(400).json({ error: 'El porcentaje debe estar entre 1 y 100' });

    const resultado = await aplicarDescuentoMasivo(periodo, pct, motivo);
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.descuentoMasivo:', err);
    res.status(500).json({ error: 'Error al aplicar el descuento masivo' });
  }
}

// POST /api/cargos/quitar-descuento-masivo  { periodo }
async function quitarDescuentoMasivoCtrl(req, res) {
  try {
    const { periodo } = req.body || {};
    if (!/^\d{4}-\d{2}$/.test(periodo || '')) return res.status(400).json({ error: 'El período debe tener el formato YYYY-MM' });
    const resultado = await quitarDescuentoMasivo(periodo);
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.quitarDescuentoMasivoCtrl:', err);
    res.status(500).json({ error: 'Error al quitar el descuento masivo' });
  }
}

// GET /api/cargos/meses-saltados/:contratoId  (meses sin cobrar mientras el contrato estuvo cortado)
async function mesesSaltados(req, res) {
  try {
    const { contratoId } = req.params;
    const resultado = await mesesSaltadosPorCorte(contratoId);
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.mesesSaltados:', err);
    res.status(500).json({ error: 'Error al calcular los meses saltados' });
  }
}

// POST /api/cargos/generar-saltados  { contratoId, periodos: ['YYYY-MM', ...] }
async function generarSaltados(req, res) {
  try {
    const { contratoId, periodos } = req.body || {};
    if (!contratoId) return res.status(400).json({ error: 'El contrato es requerido' });
    if (!Array.isArray(periodos) || periodos.length === 0) return res.status(400).json({ error: 'Selecciona al menos un período' });

    const resultado = await generarCargosSaltados(contratoId, periodos);
    // Ya se resolvió (cobrado o descartado) — se limpia fechaCorte para no volver a ofrecerlo.
    await prisma.contrato.update({ where: { id: contratoId }, data: { fechaCorte: null } });
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.generarSaltados:', err);
    res.status(500).json({ error: 'Error al generar los cargos de los meses saltados' });
  }
}

// POST /api/cargos/descartar-saltados/:contratoId  (el admin decide NO cobrar esos meses)
async function descartarSaltados(req, res) {
  try {
    const { contratoId } = req.params;
    await prisma.contrato.update({ where: { id: contratoId }, data: { fechaCorte: null } });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error en cargos.descartarSaltados:', err);
    res.status(500).json({ error: 'Error al descartar los meses saltados' });
  }
}

module.exports = {
  listarPorContrato, previsualizar, generarManual, crearManual, aplicarDescuento, quitarDescuento,
  mesesSaltados, generarSaltados, descartarSaltados, previsualizarDescuentoMasivo, descuentoMasivo,
  quitarDescuentoMasivoCtrl,
};
