const prisma = require('../utils/prisma');
const { generarCargosDelMes, periodoDe } = require('../utils/generarCargos');

// GET /api/cargos/contrato/:contratoId  (deuda pendiente de un contrato)
async function listarPorContrato(req, res) {
  try {
    const { contratoId } = req.params;
    const cargos = await prisma.cargoMensual.findMany({
      where: { contratoId, estado: 'PENDIENTE' },
      orderBy: { periodo: 'asc' },
    });
    const periodoActual = periodoDe(new Date());
    const data = cargos.map(c => ({ ...c, vencido: c.periodo < periodoActual }));
    res.json(data);
  } catch (err) {
    console.error('Error en cargos.listarPorContrato:', err);
    res.status(500).json({ error: 'Error al listar la deuda del contrato' });
  }
}

// POST /api/cargos/generar  (manual, respaldo del cron diario)
async function generarManual(req, res) {
  try {
    const resultado = await generarCargosDelMes();
    res.json(resultado);
  } catch (err) {
    console.error('Error en cargos.generarManual:', err);
    res.status(500).json({ error: 'Error al generar los cargos del mes' });
  }
}

module.exports = { listarPorContrato, generarManual };
