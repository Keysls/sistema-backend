const prisma = require('../utils/prisma');

// GET /api/dashboard/kpis
async function kpis(req, res) {
  try {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const inicioMesSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);

    const [cargosPendientes, pagosMes, contratosActivos] = await Promise.all([
      prisma.cargoMensual.findMany({
        where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
        select: { monto: true, contratoId: true, contrato: { select: { clienteId: true } }, pagos: { select: { monto: true } } },
      }),
      prisma.pago.aggregate({
        where: { fecha: { gte: inicioMes, lt: inicioMesSiguiente } },
        _sum: { monto: true },
      }),
      prisma.contrato.count({ where: { estado: 'ACTIVO' } }),
    ]);

    const deudaTotal = cargosPendientes.reduce((acc, c) => acc + Number(c.monto) - c.pagos.reduce((s, p) => s + Number(p.monto), 0), 0);
    const clientesConDeuda = new Set(cargosPendientes.map(c => c.contrato?.clienteId)).size;
    const recaudadoMes = Number(pagosMes._sum.monto || 0);

    res.json({
      data: {
        clientesConDeuda,
        deudaTotal,
        recaudadoMes,
        contratosActivos,
      },
    });
  } catch (err) {
    console.error('Error en dashboard.kpis:', err);
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
}

// GET /api/dashboard/analitica?periodo=7d
function inicioPeriodo(periodo, ahora) {
  const CONFIG_DIAS = { '3d': 3, '7d': 7, '30d': 30 };
  const CONFIG_MESES = { '6m': 6, '1a': 12 };
  if (CONFIG_DIAS[periodo] != null) {
    const dias = CONFIG_DIAS[periodo];
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - (dias - 1));
    return { inicio, esMensual: false, cantidad: dias };
  }
  const meses = CONFIG_MESES[periodo] || 6;
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - (meses - 1), 1);
  return { inicio, esMensual: true, cantidad: meses };
}

async function analitica(req, res) {
  try {
    const { periodo = '7d' } = req.query;
    const ahora = new Date();
    const { inicio, esMensual, cantidad } = inicioPeriodo(periodo, ahora);

    const pagos = await prisma.pago.findMany({
      where: { fecha: { gte: inicio } },
      select: { fecha: true, monto: true },
    });

    const puntos = [];
    if (!esMensual) {
      for (let i = 0; i < cantidad; i++) {
        const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        const siguiente = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate() + 1);
        const monto = pagos
          .filter(p => p.fecha >= dia && p.fecha < siguiente)
          .reduce((acc, p) => acc + Number(p.monto), 0);
        puntos.push({
          label: dia.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
          monto,
        });
      }
    } else {
      for (let i = 0; i < cantidad; i++) {
        const mes = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
        const siguiente = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
        const monto = pagos
          .filter(p => p.fecha >= mes && p.fecha < siguiente)
          .reduce((acc, p) => acc + Number(p.monto), 0);
        puntos.push({
          label: mes.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
          monto,
        });
      }
    }

    res.json({ data: puntos });
  } catch (err) {
    console.error('Error en dashboard.analitica:', err);
    res.status(500).json({ error: 'Error al obtener analítica' });
  }
}

// GET /api/dashboard/historial
async function historial(req, res) {
  try {
    const ordenes = await prisma.ordenServicio.findMany({
      orderBy: { fechaServicio: 'desc' },
      take: 5,
      select: {
        nServicio: true, tipoOrden: true, estado: true, abonado: true, fechaServicio: true, fechaFin: true,
        tecnico: { select: { nombre: true, apellido: true } },
        contrato: { select: { tipoServicio: true } },
      },
    });

    res.json({
      data: ordenes.map(o => ({
        numeroOrden: o.nServicio,
        cliente: o.abonado,
        tecnico: o.tecnico ? `${o.tecnico.nombre} ${o.tecnico.apellido}` : '—',
        tipoOrden: o.tipoOrden,
        estado: o.estado,
        fecha: o.fechaServicio,
        fechaFin: o.fechaFin,
      })),
    });
  } catch (err) {
    console.error('Error en dashboard.historial:', err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
}

// GET /api/dashboard/servicios  (cuántos contratos activos hay por tipo de servicio y por plan)
async function servicios(req, res) {
  try {
    const contratos = await prisma.contrato.findMany({
      where: { estado: 'ACTIVO' },
      select: { tipoServicio: true, plan: { select: { nombre: true } } },
    });

    const porTipo = { INTERNET: 0, CABLE: 0, DUO: 0 };
    const conteoPlanes = new Map();
    for (const c of contratos) {
      porTipo[c.tipoServicio] = (porTipo[c.tipoServicio] || 0) + 1;
      const nombrePlan = c.plan?.nombre || 'Sin plan';
      conteoPlanes.set(nombrePlan, (conteoPlanes.get(nombrePlan) || 0) + 1);
    }

    const porPlan = Array.from(conteoPlanes.entries())
      .map(([plan, cantidad]) => ({ plan, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    res.json({
      data: {
        total: contratos.length,
        porTipo: [
          { tipo: 'INTERNET', label: 'Internet', cantidad: porTipo.INTERNET },
          { tipo: 'CABLE', label: 'Cable', cantidad: porTipo.CABLE },
          { tipo: 'DUO', label: 'Dúo', cantidad: porTipo.DUO },
        ],
        porPlan,
      },
    });
  } catch (err) {
    console.error('Error en dashboard.servicios:', err);
    res.status(500).json({ error: 'Error al obtener la distribución de servicios' });
  }
}

module.exports = { kpis, analitica, historial, servicios };
