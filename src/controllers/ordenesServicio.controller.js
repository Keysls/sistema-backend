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

// Al completar una orden de este tipo (sin el sufijo _I/_C/_D), el contrato
// relacionado cambia automáticamente a este estado.
const ESTADO_CONTRATO_POR_TIPO = {
  CORTE_SOLICITUD: 'CORTADO',
  CORTE_DEUDA: 'CORTADO',
  BAJA_SERVICIO: 'BAJA',
  RECONEXION: 'ACTIVO',
};

// Descuenta 1 unidad de stock del equipo (ONU/decodificador) asignado a una
// instalación/cambio de equipo. Lanza un error (bloquea la orden) si no hay stock.
async function descontarEquipoDeInventario(productoId) {
  const producto = await prisma.producto.findUnique({ where: { id: Number(productoId) } });
  if (!producto) throw new Error('El equipo seleccionado no existe en el catálogo');
  if (producto.esMedible) return; // los productos medibles se descuentan por consumos, no por unidad de equipo
  if (producto.stockTotal < 1) throw new Error(`Sin stock de "${producto.nombre}" para asignar como equipo`);
  await prisma.producto.update({ where: { id: producto.id }, data: { stockTotal: { decrement: 1 } } });
  await prisma.movimientoStock.create({
    data: { productoId: producto.id, tipo: 'SALIDA', cantidad: 1, motivo: 'Equipo asignado en orden de servicio' },
  });
}

const INCLUDE_ORDEN = {
  contrato: { select: { id: true, numero: true, tipoServicio: true, estado: true } },
  tecnico: { select: { id: true, nombre: true, apellido: true } },
  plan: true,
};

// Igual que en contratos.controller.js: `nServicio` es texto, así que no se puede
// ordenar desc y confiar en que el primero sea el "mayor" numéricamente — se filtran
// solo los que siguen el formato OS########## y se toma el máximo real entre esos.
async function generarNumero() {
  const candidatos = await prisma.ordenServicio.findMany({ where: { nServicio: { startsWith: 'OS' } }, select: { nServicio: true } });
  let max = 0;
  for (const { nServicio } of candidatos) {
    if (/^OS\d{10}$/.test(nServicio)) {
      const n = parseInt(nServicio.slice(2), 10);
      if (n > max) max = n;
    }
  }
  return 'OS' + String(max + 1).padStart(10, '0');
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
    ipWan, mascara, gateway, pppoeUsuario, pppoePassword, mensualidad, mbps, planId,
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
    pppoeUsuario: pppoeUsuario?.trim() || null,
    pppoePassword: pppoePassword?.trim() || null,
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
    if (ordenActual.estado === 'COMPLETADA') {
      return res.status(400).json({ error: 'Esta orden ya está completada y no se puede modificar' });
    }

    const data = { estado };
    if (estado === 'ASIGNADA') {
      if (!tecnicoId) return res.status(400).json({ error: 'Selecciona un técnico para asignar la orden' });
      data.tecnicoId = tecnicoId;
      data.fechaAsignacion = new Date();
    }
    if (estado === 'EN_PROCESO') data.fechaInicio = new Date();

    const esInstalacion = ordenActual.tipoOrden.startsWith('INSTALACION');
    const tipoBase = ordenActual.tipoOrden.replace(/_[ICD]$/, '');
    const nuevoEstadoContrato = ESTADO_CONTRATO_POR_TIPO[tipoBase] || null;
    let fechaInstalacionFinal = null;
    if (estado === 'COMPLETADA') {
      data.fechaFin = new Date();

      // La IP WAN y el usuario PPPoE de la orden se sincronizan al contrato al
      // completarla — pero antes se valida que no choquen con otro contrato.
      if (ordenActual.contratoId && (ordenActual.ipWan || ordenActual.pppoeUsuario)) {
        if (ordenActual.ipWan) {
          const otroPorIp = await prisma.contrato.findFirst({
            where: { ipWan: ordenActual.ipWan, id: { not: ordenActual.contratoId } },
          });
          if (otroPorIp) return res.status(409).json({ error: `La IP WAN ${ordenActual.ipWan} ya está en uso por el contrato ${otroPorIp.numero}` });
        }
        if (ordenActual.pppoeUsuario) {
          const otroPorUsuario = await prisma.contrato.findFirst({
            where: { pppoeUsuario: ordenActual.pppoeUsuario, id: { not: ordenActual.contratoId } },
          });
          if (otroPorUsuario) return res.status(409).json({ error: `El usuario PPPoE ${ordenActual.pppoeUsuario} ya está en uso por el contrato ${otroPorUsuario.numero}` });
        }
        await prisma.contrato.update({
          where: { id: ordenActual.contratoId },
          data: {
            ipWan: ordenActual.ipWan, mascara: ordenActual.mascara, gateway: ordenActual.gateway,
            pppoeUsuario: ordenActual.pppoeUsuario, pppoePassword: ordenActual.pppoePassword,
          },
        });
      }

      if (esInstalacion && ordenActual.contratoId) {
        fechaInstalacionFinal = fechaInstalacion ? new Date(fechaInstalacion) : new Date();
        if (equipoProductoId) {
          try {
            await descontarEquipoDeInventario(equipoProductoId);
          } catch (err) {
            return res.status(409).json({ error: err.message });
          }
        }
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
      } else if (nuevoEstadoContrato && ordenActual.contratoId) {
        await prisma.contrato.update({
          where: { id: ordenActual.contratoId },
          data: {
            estado: nuevoEstadoContrato,
            // Al cortar, se guarda cuándo ocurrió para poder ofrecer cobrar los
            // meses saltados si luego se reconecta. Al reconectar no se borra
            // aquí — se limpia solo cuando el admin resuelve esos meses saltados.
            ...(nuevoEstadoContrato === 'CORTADO' ? { fechaCorte: new Date() } : {}),
          },
        });
      } else if (tipoBase === 'CAMBIO_EQUIPO' && ordenActual.contratoId) {
        if (equipoProductoId) {
          try {
            await descontarEquipoDeInventario(equipoProductoId);
          } catch (err) {
            return res.status(409).json({ error: err.message });
          }
        }
        await prisma.contrato.update({
          where: { id: ordenActual.contratoId },
          data: {
            equipoProductoId: equipoProductoId ? Number(equipoProductoId) : undefined,
            equipoSerie: equipoSerie?.trim() || undefined,
          },
        });
      } else if (tipoBase === 'RETIRO_EQUIPO' && ordenActual.contratoId) {
        // Al retirar el equipo, el contrato deja de tener equipo/precinto asignado.
        await prisma.contrato.update({
          where: { id: ordenActual.contratoId },
          data: { equipoProductoId: null, equipoSerie: null, precinto: null },
        });
      } else if (tipoBase === 'CAMBIO_PLAN' && ordenActual.contratoId) {
        // El plan/mensualidad/mbps nuevos ya se eligieron al crear la orden;
        // al completarla se trasladan al contrato para que se facture con el plan nuevo.
        // Si el plan elegido es de otro tipo de servicio (ej. contrato Dúo migrando a
        // solo Internet), el contrato también cambia de tipoServicio para reflejarlo.
        const planNuevo = ordenActual.planId ? await prisma.plan.findUnique({ where: { id: ordenActual.planId } }) : null;
        await prisma.contrato.update({
          where: { id: ordenActual.contratoId },
          data: {
            planId: ordenActual.planId || null,
            mbps: ordenActual.mbps ?? undefined,
            costoMensual: ordenActual.mensualidad ?? undefined,
            ...(planNuevo ? { tipoServicio: planNuevo.tipoServicio } : {}),
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
