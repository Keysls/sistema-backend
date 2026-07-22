const prisma = require('../utils/prisma');
const { generarCargosDelMes, previsualizarCargosDelMes, estaVencido } = require('../utils/generarCargos');

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

module.exports = { listarPorContrato, previsualizar, generarManual, crearManual };
