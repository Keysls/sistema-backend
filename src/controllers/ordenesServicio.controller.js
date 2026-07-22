const prisma = require('../utils/prisma');
const { generarCargoProrrateado } = require('../utils/generarCargos');

const ESTADOS = ['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA'];
const TIPOS_ORDEN = [
  'INSTALACION_I', 'ALTA_SERVICIO_I', 'ATENCION_NOC_I', 'AVERIA_I', 'BAJA_SERVICIO_I',
  'CAMBIO_CONTRASENA_I', 'CAMBIO_DOMICILIO_I', 'CAMBIO_EQUIPO_I', 'CAMBIO_PLAN_I',
  'CAMBIO_TITULAR_I', 'CORTE_SOLICITUD_I', 'CORTE_DEUDA_I', 'RECONEXION_I', 'RETIRO_EQUIPO_I', 'TRASLADO_I',
  'INSTALACION_C', 'ALTA_SERVICIO_C', 'AVERIA_C', 'CAMBIO_DOMICILIO_C', 'CAMBIO_PLAN_C',
  'CAMBIO_TITULAR_C', 'CORTE_SOLICITUD_C', 'CORTE_DEUDA_C', 'INSTALACION_ANEXO_C', 'MIGRACION_FTTH_C',
  'RECONEXION_C', 'RETIRO_EQUIPO_C', 'SUPERVISION_C', 'TRASLADO_C',
  'INSTALACION_D', 'ALTA_SERVICIO_D', 'AVERIA_D', 'CAMBIO_DOMICILIO_D', 'CAMBIO_EQUIPO_D',
  'CAMBIO_PLAN_D', 'CAMBIO_TITULAR_D', 'CORTE_SOLICITUD_D', 'CORTE_DEUDA_D', 'RECONEXION_D',
  'RETIRO_EQUIPO_D', 'TRASLADO_D', 'BAJA_SERVICIO_D',
];

const INCLUDE_ORDEN = {
  contrato: { select: { id: true, numero: true, tipoServicio: true } },
  tecnico: { select: { id: true, nombre: true, apellido: true } },
  plan: true,
};

async function generarNumero() {
  const ultimo = await prisma.ordenServicio.findFirst({ orderBy: { nServicio: 'desc' } });
  const ultimoNum = ultimo ? parseInt(ultimo.nServicio.replace(/^OS/, ''), 10) : 0;
  const siguiente = (ultimoNum || 0) + 1;
  return 'OS' + String(siguiente).padStart(10, '0');
}

// GET /api/ordenes-servicio?q=&estado=&tipoOrden=&tecnicoId=&grupo=I|C|D
async function listar(req, res) {
  try {
    const { q, estado, tipoOrden, tecnicoId, grupo } = req.query;
    const where = {
      ...(estado ? { estado } : {}),
      ...(tipoOrden ? { tipoOrden } : {}),
      ...(grupo && ['I', 'C', 'D'].includes(grupo) ? { tipoOrden: { in: TIPOS_ORDEN.filter(t => t.endsWith(`_${grupo}`)) } } : {}),
      ...(tecnicoId ? { tecnicoId } : {}),
      ...(q
        ? {
            OR: [
              { nServicio: { contains: q, mode: 'insensitive' } },
              { abonado: { contains: q, mode: 'insensitive' } },
              { dni: { contains: q, mode: 'insensitive' } },
              { direccion: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const data = await prisma.ordenServicio.findMany({ where, include: INCLUDE_ORDEN, orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (err) {
    console.error('Error en ordenesServicio.listar:', err);
    res.status(500).json({ error: 'Error al listar las órdenes de servicio' });
  }
}

// GET /api/ordenes-servicio/:id
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const orden = await prisma.ordenServicio.findUnique({ where: { id }, include: INCLUDE_ORDEN });
    if (!orden) return res.status(404).json({ error: 'Orden de servicio no encontrada' });
    res.json(orden);
  } catch (err) {
    console.error('Error en ordenesServicio.obtener:', err);
    res.status(500).json({ error: 'Error al obtener la orden de servicio' });
  }
}

function validarPayload(body) {
  const { tipoOrden, estado, fechaServicio, abonado, direccion } = body;
  if (!TIPOS_ORDEN.includes(tipoOrden)) return 'Tipo de orden inválido';
  if (estado && !ESTADOS.includes(estado)) return 'Estado inválido';
  if (!fechaServicio) return 'La fecha de servicio es requerida';
  if (!abonado?.trim()) return 'El nombre del abonado es requerido';
  if (!direccion?.trim()) return 'La dirección es requerida';
  return null;
}

function armarData(body) {
  const {
    contratoId, tipoOrden, estado, fechaServicio, abonado, dni, direccion, referencia, sector, celular,
    observacion, tecnicoId, fechaAsignacion, fechaInicio, fechaFin, tiempoInstalacion,
    ipWan, mascara, gateway, mensualidad, mbps, planId,
  } = body;

  return {
    contratoId: contratoId || null,
    tipoOrden,
    ...(estado ? { estado } : {}),
    fechaServicio: new Date(fechaServicio),
    abonado: abonado.trim(),
    dni: dni?.trim() || null,
    direccion: direccion.trim(),
    referencia: referencia?.trim() || null,
    sector: sector?.trim() || null,
    celular: celular?.trim() || null,
    observacion: observacion?.trim() || null,
    tecnicoId: tecnicoId || null,
    fechaAsignacion: fechaAsignacion ? new Date(fechaAsignacion) : null,
    fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
    fechaFin: fechaFin ? new Date(fechaFin) : null,
    tiempoInstalacion: tiempoInstalacion !== '' && tiempoInstalacion !== undefined && tiempoInstalacion !== null ? Number(tiempoInstalacion) : null,
    ipWan: ipWan?.trim() || null,
    mascara: mascara?.trim() || null,
    gateway: gateway?.trim() || null,
    mensualidad: mensualidad !== '' && mensualidad !== undefined && mensualidad !== null ? Number(mensualidad) : null,
    mbps: mbps !== '' && mbps !== undefined && mbps !== null ? Number(mbps) : null,
    planId: planId || null,
  };
}

// POST /api/ordenes-servicio
async function crear(req, res) {
  try {
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const nServicio = await generarNumero();

    const orden = await prisma.ordenServicio.create({
      data: { nServicio, ...armarData(req.body) },
      include: INCLUDE_ORDEN,
    });

    res.status(201).json(orden);
  } catch (err) {
    console.error('Error en ordenesServicio.crear:', err);
    res.status(500).json({ error: 'Error al crear la orden de servicio' });
  }
}

// PUT /api/ordenes-servicio/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const orden = await prisma.ordenServicio.update({
      where: { id },
      data: armarData(req.body),
      include: INCLUDE_ORDEN,
    });

    res.json(orden);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Orden de servicio no encontrada' });
    console.error('Error en ordenesServicio.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar la orden de servicio' });
  }
}

// PATCH /api/ordenes-servicio/:id/estado
async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado, tecnicoId, puntoRedId, equipoProductoId, equipoSerie, fechaInstalacion } = req.body;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const ordenActual = await prisma.ordenServicio.findUnique({ where: { id } });
    if (!ordenActual) return res.status(404).json({ error: 'Orden de servicio no encontrada' });

    const data = { estado };
    if (estado === 'ASIGNADA') {
      if (!tecnicoId) return res.status(400).json({ error: 'Selecciona un técnico para asignar la orden' });
      data.tecnicoId = tecnicoId;
      data.fechaAsignacion = new Date();
    }
    if (estado === 'EN_PROCESO') data.fechaInicio = new Date();

    const esInstalacion = ordenActual.tipoOrden.startsWith('INSTALACION');
    let fechaInstalacionFinal = null;
    if (estado === 'COMPLETADA') {
      data.fechaFin = new Date();
      if (esInstalacion && ordenActual.contratoId) {
        fechaInstalacionFinal = fechaInstalacion ? new Date(fechaInstalacion) : new Date();
        await prisma.contrato.update({
          where: { id: ordenActual.contratoId },
          data: {
            puntoRedId: puntoRedId || undefined,
            equipoProductoId: equipoProductoId ? Number(equipoProductoId) : undefined,
            equipoSerie: equipoSerie?.trim() || undefined,
            tecnicoInstaladorId: ordenActual.tecnicoId || undefined,
            fechaInstalacion: fechaInstalacionFinal,
          },
        });
      }
    }

    const orden = await prisma.ordenServicio.update({ where: { id }, data, include: INCLUDE_ORDEN });

    if (fechaInstalacionFinal && ordenActual.contratoId) {
      const contrato = await prisma.contrato.findUnique({ where: { id: ordenActual.contratoId } });
      if (contrato?.estado === 'ACTIVO') {
        await generarCargoProrrateado(contrato, fechaInstalacionFinal)
          .catch(err => console.error('Error al generar el cargo prorrateado:', err));
      }
    }

    res.json(orden);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Orden de servicio no encontrada' });
    console.error('Error en ordenesServicio.cambiarEstado:', err);
    res.status(500).json({ error: 'Error al cambiar el estado' });
  }
}

// GET /api/ordenes-servicio/stats
async function stats(req, res) {
  try {
    const [porEstadoRaw, porTipoRaw, ordenes] = await Promise.all([
      prisma.ordenServicio.groupBy({ by: ['estado'], _count: { _all: true } }),
      prisma.ordenServicio.groupBy({ by: ['tipoOrden'], _count: { _all: true } }),
      prisma.ordenServicio.findMany({
        select: { estado: true, tecnicoId: true, tecnico: { select: { id: true, nombre: true, apellido: true } } },
      }),
    ]);

    const porEstado = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: 0 }), {});
    porEstadoRaw.forEach(r => { porEstado[r.estado] = r._count._all; });

    const porServicio = { I: 0, C: 0, D: 0 };
    porTipoRaw.forEach(r => {
      const sufijo = r.tipoOrden.slice(-1);
      if (porServicio[sufijo] != null) porServicio[sufijo] += r._count._all;
    });

    const tecnicosMap = {};
    for (const o of ordenes) {
      if (!o.tecnicoId) continue;
      const key = o.tecnicoId;
      if (!tecnicosMap[key]) {
        tecnicosMap[key] = { id: key, nombre: `${o.tecnico?.nombre || ''} ${o.tecnico?.apellido || ''}`.trim(), total: 0, completadas: 0 };
      }
      tecnicosMap[key].total++;
      if (o.estado === 'COMPLETADA') tecnicosMap[key].completadas++;
    }
    const tecnicos = Object.values(tecnicosMap).sort((a, b) => b.total - a.total);

    const total = ordenes.length;

    res.json({
      total,
      porEstado,
      porServicio,
      tecnicos,
    });
  } catch (err) {
    console.error('Error en ordenesServicio.stats:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, stats };
