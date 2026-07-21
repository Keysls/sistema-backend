const prisma = require('./prisma');

function periodoDe(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

// Genera el cargo mensual (cuota) de cada contrato ACTIVO cuyo día de corte
// ya llegó (o pasó) y todavía no tiene un cargo creado para el período actual.
async function generarCargosDelMes() {
  const hoy = new Date();
  const periodo = periodoDe(hoy);
  const diaHoy = hoy.getDate();

  const contratos = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO' },
    include: { plan: { select: { precio: true } } },
  });

  let creados = 0;
  let omitidos = 0;

  for (const c of contratos) {
    const diaCorte = c.diaCorte || 1;
    if (diaHoy < diaCorte) continue; // aún no llega su día de corte este mes

    const monto = c.costoMensual != null ? Number(c.costoMensual) : (c.plan?.precio != null ? Number(c.plan.precio) : 0);
    if (!monto || monto <= 0) { omitidos++; continue; }

    const yaExiste = await prisma.cargoMensual.findUnique({
      where: { contratoId_periodo: { contratoId: c.id, periodo } },
    });
    if (yaExiste) continue;

    const vencimiento = new Date(hoy.getFullYear(), hoy.getMonth(), diaCorte);
    await prisma.cargoMensual.create({
      data: { contratoId: c.id, periodo, monto, vencimiento, estado: 'PENDIENTE' },
    });
    creados++;
  }

  return { creados, omitidos, periodo };
}

module.exports = { generarCargosDelMes, periodoDe };
