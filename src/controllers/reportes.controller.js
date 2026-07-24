const prisma = require('../utils/prisma');

function periodoDe(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function sumarMeses(periodo, n) {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + n, 1);
  return periodoDe(fecha);
}

// GET /api/reportes/morosidad?meses=12
// Reporte histórico mes a mes: cuánto se facturó, cuánto se cobró, cuánto quedó
// pendiente, cuántos clientes con deuda y cuánto se descontó, por cada período
// (CargoMensual.periodo) de los últimos N meses.
async function morosidad(req, res) {
  try {
    const cantidadMeses = Math.min(Math.max(Number(req.query.meses) || 12, 1), 36);
    const hoy = new Date();
    const periodoActual = periodoDe(hoy);
    let periodoInicio = periodoActual;
    for (let i = 1; i < cantidadMeses; i++) periodoInicio = sumarMeses(periodoInicio, -1);

    const periodos = [];
    let p = periodoInicio;
    while (p <= periodoActual) { periodos.push(p); p = sumarMeses(p, 1); }

    const cargos = await prisma.cargoMensual.findMany({
      where: { periodo: { in: periodos } },
      select: {
        periodo: true, monto: true, montoOriginal: true, estado: true, contratoId: true,
        pagos: { select: { monto: true } },
      },
    });

    const filas = periodos.map(periodo => {
      const delMes = cargos.filter(c => c.periodo === periodo);
      const facturado = delMes.reduce((s, c) => s + Number(c.monto), 0);
      const cobrado = delMes.reduce((s, c) => s + c.pagos.reduce((s2, pg) => s2 + Number(pg.monto), 0), 0);
      const pendiente = delMes
        .filter(c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
        .reduce((s, c) => s + (Number(c.monto) - c.pagos.reduce((s2, pg) => s2 + Number(pg.monto), 0)), 0);
      const clientesConDeuda = new Set(
        delMes.filter(c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL').map(c => c.contratoId)
      ).size;
      const descuentos = delMes
        .filter(c => c.montoOriginal != null)
        .reduce((s, c) => s + (Number(c.montoOriginal) - Number(c.monto)), 0);

      return {
        periodo,
        facturado: Math.round(facturado * 100) / 100,
        cobrado: Math.round(cobrado * 100) / 100,
        pendiente: Math.round(pendiente * 100) / 100,
        clientesConDeuda,
        descuentos: Math.round(descuentos * 100) / 100,
        cargos: delMes.length,
      };
    });

    res.json({ data: filas });
  } catch (err) {
    console.error('Error en reportes.morosidad:', err);
    res.status(500).json({ error: 'Error al generar el reporte de morosidad' });
  }
}

module.exports = { morosidad };
