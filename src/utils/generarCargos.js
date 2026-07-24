const prisma = require('./prisma');

function periodoDe(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

// Devuelve los contratos ACTIVOS que generarían un cargo si se ejecutara
// "generarCargosDelMes" ahora mismo (día de corte ya llegado y sin cargo del período).
async function previsualizarCargosDelMes() {
  const hoy = new Date();
  const periodo = periodoDe(hoy);
  const diaHoy = hoy.getDate();

  const contratos = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO', fechaInstalacion: { not: null } },
    include: { plan: { select: { precio: true } }, cliente: { select: { nombres: true, apellidos: true } } },
  });

  const elegibles = [];
  for (const c of contratos) {
    const diaCorte = c.diaCorte || 1;
    if (diaHoy < diaCorte) continue;

    const monto = c.costoMensual != null ? Number(c.costoMensual) : (c.plan?.precio != null ? Number(c.plan.precio) : 0);
    if (!monto || monto <= 0) continue;

    const yaExiste = await prisma.cargoMensual.findUnique({
      where: { contratoId_periodo: { contratoId: c.id, periodo } },
    });
    if (yaExiste) continue;

    elegibles.push({
      contratoId: c.id,
      numero: c.numero,
      cliente: [c.cliente?.nombres, c.cliente?.apellidos].filter(Boolean).join(' '),
      monto,
    });
  }

  return { periodo, contratos: elegibles };
}

// Genera el cargo mensual (cuota) de cada contrato ACTIVO cuyo día de corte
// ya llegó (o pasó) y todavía no tiene un cargo creado para el período actual.
// `exonerarIds`: contratos a los que NO se les cobra este mes (cargo en 0, estado EXONERADO).
// `descuentos`: mapa { contratoId: porcentaje } para aplicar un descuento puntual este mes.
async function generarCargosDelMes({ exonerarIds = [], descuentos = {} } = {}) {
  const hoy = new Date();
  const periodo = periodoDe(hoy);
  const diaHoy = hoy.getDate();
  const setExonerados = new Set(exonerarIds);

  const contratos = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO', fechaInstalacion: { not: null } },
    include: { plan: { select: { precio: true } } },
  });

  let creados = 0;
  let omitidos = 0;

  for (const c of contratos) {
    const diaCorte = c.diaCorte || 1;
    if (diaHoy < diaCorte) continue; // aún no llega su día de corte este mes

    const montoBase = c.costoMensual != null ? Number(c.costoMensual) : (c.plan?.precio != null ? Number(c.plan.precio) : 0);
    if (!montoBase || montoBase <= 0) { omitidos++; continue; }

    const yaExiste = await prisma.cargoMensual.findUnique({
      where: { contratoId_periodo: { contratoId: c.id, periodo } },
    });
    if (yaExiste) continue;

    const vencimiento = new Date(hoy.getFullYear(), hoy.getMonth(), diaCorte);

    let monto = montoBase;
    let estado = 'PENDIENTE';
    let nota = null;

    if (setExonerados.has(c.id)) {
      monto = 0;
      estado = 'EXONERADO';
      nota = 'Exonerado';
    } else {
      const descuento = Number(descuentos[c.id]);
      if (descuento > 0) {
        monto = Math.round(montoBase * (1 - descuento / 100) * 100) / 100;
        nota = `Descuento ${descuento}%`;
      }
    }

    await prisma.cargoMensual.create({
      data: { contratoId: c.id, periodo, monto, vencimiento, estado, nota },
    });
    creados++;
  }

  return { creados, omitidos, periodo };
}

// Crea el cargo del primer mes de un contrato nuevo, prorrateado desde la fecha
// de instalación/creación hasta el fin de ese mes (si crea el 22/07 con mensualidad
// de 80 y julio tiene 31 días, cobra solo los 10 días restantes: 80 * 10/31).
async function generarCargoProrrateado(contrato, fechaInicio = new Date()) {
  const monto = contrato.costoMensual != null ? Number(contrato.costoMensual) : (contrato.plan?.precio != null ? Number(contrato.plan.precio) : 0);
  if (!monto || monto <= 0) return null;

  const periodo = periodoDe(fechaInicio);
  const yaExiste = await prisma.cargoMensual.findUnique({
    where: { contratoId_periodo: { contratoId: contrato.id, periodo } },
  });
  if (yaExiste) return null;

  const anio = fechaInicio.getFullYear();
  const mes = fechaInicio.getMonth();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const diaInicio = fechaInicio.getDate();
  const diasRestantes = diasEnMes - diaInicio + 1;

  const esMesCompleto = diasRestantes >= diasEnMes;
  const montoProrrateado = esMesCompleto ? monto : Math.round((monto * diasRestantes / diasEnMes) * 100) / 100;

  const vencimiento = new Date(anio, mes, contrato.diaCorte || diasEnMes);

  return prisma.cargoMensual.create({
    data: { contratoId: contrato.id, periodo, monto: montoProrrateado, vencimiento, estado: 'PENDIENTE' },
  });
}

// Fecha límite de pago de un cargo: el día de corte del mes SIGUIENTE al período
// facturado (ej. debe junio con día de corte 23 → tiene plazo hasta el 23 de julio).
function fechaLimitePago(periodo, diaCorte) {
  const [anio, mes] = periodo.split('-').map(Number); // mes: 1-12
  const diasMesSiguiente = new Date(anio, mes + 1, 0).getDate();
  const dia = Math.min(diaCorte || 1, diasMesSiguiente);
  return new Date(anio, mes, dia); // mes (0-based) ya apunta al mes siguiente al período
}

function estaVencido(periodo, diaCorte, ahora = new Date()) {
  return ahora > fechaLimitePago(periodo, diaCorte);
}

// Suma `n` meses a un período 'YYYY-MM' y devuelve el nuevo período en el mismo formato.
function sumarMeses(periodo, n) {
  const [anio, mes] = periodo.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + n, 1);
  return periodoDe(fecha);
}

// Devuelve los períodos (meses) que un contrato se saltó mientras estuvo cortado:
// desde el mes en que se cortó (contrato.fechaCorte) hasta el mes actual, excluyendo
// los que ya tienen un CargoMensual creado. Se usa al reconectar, para ofrecer
// cobrarle esos meses en vez de perderlos silenciosamente.
async function mesesSaltadosPorCorte(contratoId) {
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    include: { plan: { select: { precio: true } } },
  });
  if (!contrato || !contrato.fechaCorte) return { periodos: [], monto: 0 };

  const monto = contrato.costoMensual != null ? Number(contrato.costoMensual) : (contrato.plan?.precio != null ? Number(contrato.plan.precio) : 0);
  if (!monto || monto <= 0) return { periodos: [], monto: 0 };

  const periodoInicio = periodoDe(contrato.fechaCorte);
  const periodoFin = periodoDe(new Date());

  const periodos = [];
  let periodoActual = periodoInicio;
  while (periodoActual <= periodoFin) {
    const yaExiste = await prisma.cargoMensual.findUnique({
      where: { contratoId_periodo: { contratoId, periodo: periodoActual } },
    });
    if (!yaExiste) periodos.push(periodoActual);
    periodoActual = sumarMeses(periodoActual, 1);
  }

  return { periodos, monto };
}

// Crea el cargo (monto completo, PENDIENTE) de cada período indicado que aún no
// tenga cargo — usado tras confirmar cuáles de los "meses saltados" se van a cobrar.
async function generarCargosSaltados(contratoId, periodos) {
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    include: { plan: { select: { precio: true } } },
  });
  if (!contrato) return { creados: 0 };

  const monto = contrato.costoMensual != null ? Number(contrato.costoMensual) : (contrato.plan?.precio != null ? Number(contrato.plan.precio) : 0);
  if (!monto || monto <= 0) return { creados: 0 };

  let creados = 0;
  for (const periodo of periodos) {
    const [anio, mes] = periodo.split('-').map(Number);
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const diaVencimiento = Math.min(contrato.diaCorte || diasEnMes, diasEnMes);
    const vencimiento = new Date(anio, mes - 1, diaVencimiento);

    const yaExiste = await prisma.cargoMensual.findUnique({
      where: { contratoId_periodo: { contratoId, periodo } },
    });
    if (yaExiste) continue;

    await prisma.cargoMensual.create({
      data: { contratoId, periodo, monto, vencimiento, estado: 'PENDIENTE', nota: 'Mes cobrado tras reconexión' },
    });
    creados++;
  }

  return { creados };
}

// Aplica un % de descuento a TODOS los cargos PENDIENTES (sin abonos) de un período
// dado — por ejemplo, para dar 10% a todos los clientes por Fiestas Patrias en julio.
// Igual que el descuento individual, siempre calcula desde el monto original guardado,
// así que se puede volver a llamar con otro % sin ir descontando en cascada, y cada
// cargo se puede revertir individualmente después con "Quitar descuento".
async function aplicarDescuentoMasivo(periodo, porcentaje, motivo) {
  const pct = Number(porcentaje);
  const cargos = await prisma.cargoMensual.findMany({ where: { periodo, estado: 'PENDIENTE' } });

  let actualizados = 0;
  for (const cargo of cargos) {
    const base = cargo.montoOriginal != null ? Number(cargo.montoOriginal) : Number(cargo.monto);
    const nuevoMonto = Math.round(base * (1 - pct / 100) * 100) / 100;
    await prisma.cargoMensual.update({
      where: { id: cargo.id },
      data: { monto: nuevoMonto, montoOriginal: base, nota: motivo?.trim() || `Descuento ${pct}% aplicado a todos` },
    });
    actualizados++;
  }

  return { actualizados };
}

// Revierte a TODOS los cargos pendientes de un período que tengan un descuento
// activo (individual o masivo) de vuelta a su monto original.
async function quitarDescuentoMasivo(periodo) {
  const cargos = await prisma.cargoMensual.findMany({
    where: { periodo, estado: 'PENDIENTE', montoOriginal: { not: null } },
  });

  let revertidos = 0;
  for (const cargo of cargos) {
    await prisma.cargoMensual.update({
      where: { id: cargo.id },
      data: { monto: cargo.montoOriginal, montoOriginal: null, nota: null },
    });
    revertidos++;
  }

  return { revertidos };
}

module.exports = {
  generarCargosDelMes, previsualizarCargosDelMes, periodoDe, generarCargoProrrateado,
  fechaLimitePago, estaVencido, mesesSaltadosPorCorte, generarCargosSaltados,
  aplicarDescuentoMasivo, quitarDescuentoMasivo,
};
