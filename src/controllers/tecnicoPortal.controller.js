const prisma = require('../utils/prisma');
const { generarCargoProrrateado } = require('../utils/generarCargos');

const ESTADO_CONTRATO_POR_TIPO = {
  CORTE_SOLICITUD: 'CORTADO',
  CORTE_DEUDA: 'CORTADO',
  BAJA_SERVICIO: 'BAJA',
  RECONEXION: 'ACTIVO',
};

// Descuenta 1 unidad de stock del equipo (ONU/decodificador) asignado — dentro de
// una transacción (tx), igual que el mismo helper en ordenesServicio.controller.js.
async function descontarEquipoDeInventario(tx, productoId) {
  const producto = await tx.producto.findUnique({ where: { id: Number(productoId) } });
  if (!producto) throw new Error('El equipo seleccionado no existe en el catálogo');
  if (producto.esMedible) return;
  if (producto.stockTotal < 1) throw new Error(`Sin stock de "${producto.nombre}" para asignar como equipo`);
  await tx.producto.update({ where: { id: producto.id }, data: { stockTotal: { decrement: 1 } } });
  await tx.movimientoStock.create({
    data: { productoId: producto.id, tipo: 'SALIDA', cantidad: 1, motivo: 'Equipo asignado en orden de servicio' },
  });
}

const INCLUDE_ORDEN = {
  contrato: { select: { id: true, numero: true, tipoServicio: true, latitud: true, longitud: true, direccion: true, precinto: true, equipoProductoId: true, equipoSerie: true } },
  tecnico: { select: { id: true, nombre: true, apellido: true } },
  plan: true,
  consumos: { include: { producto: { select: { id: true, nombre: true, unidad: true } } } },
};

// GET /api/tecnico/ordenes  (pendientes sin asignar + las mías en curso)
async function listarOrdenes(req, res) {
  try {
    const tecnicoId = req.tecnico.id;
    const data = await prisma.ordenServicio.findMany({
      where: {
        OR: [
          { estado: 'PENDIENTE', tecnicoId: null },
          { tecnicoId, estado: { in: ['ASIGNADA', 'EN_PROCESO'] } },
        ],
      },
      include: INCLUDE_ORDEN,
      orderBy: { fechaServicio: 'asc' },
    });
    res.json(data);
  } catch (err) {
    console.error('Error en tecnicoPortal.listarOrdenes:', err);
    res.status(500).json({ error: 'Error al listar las órdenes' });
  }
}

// GET /api/tecnico/ordenes/historial  (mis órdenes completadas/canceladas recientes)
async function historialOrdenes(req, res) {
  try {
    const tecnicoId = req.tecnico.id;
    const data = await prisma.ordenServicio.findMany({
      where: { tecnicoId, estado: { in: ['COMPLETADA', 'CANCELADA'] } },
      include: INCLUDE_ORDEN,
      orderBy: { fechaFin: 'desc' },
      take: 30,
    });
    res.json(data);
  } catch (err) {
    console.error('Error en tecnicoPortal.historialOrdenes:', err);
    res.status(500).json({ error: 'Error al listar el historial' });
  }
}

async function obtenerVisible(id, tecnicoId) {
  const orden = await prisma.ordenServicio.findUnique({ where: { id }, include: INCLUDE_ORDEN });
  if (!orden) return null;
  const visible = (orden.estado === 'PENDIENTE' && !orden.tecnicoId) || orden.tecnicoId === tecnicoId;
  return visible ? orden : undefined;
}

// GET /api/tecnico/ordenes/:id
async function obtenerOrden(req, res) {
  try {
    const orden = await obtenerVisible(req.params.id, req.tecnico.id);
    if (orden === null) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden === undefined) return res.status(403).json({ error: 'No tienes acceso a esta orden' });
    res.json(orden);
  } catch (err) {
    console.error('Error en tecnicoPortal.obtenerOrden:', err);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
}

// POST /api/tecnico/ordenes/:id/tomar
async function tomarOrden(req, res) {
  try {
    const { id } = req.params;
    const tecnicoId = req.tecnico.id;

    const orden = await prisma.ordenServicio.findUnique({ where: { id } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.estado !== 'PENDIENTE' || orden.tecnicoId) {
      return res.status(400).json({ error: 'Esta orden ya fue tomada por otro técnico' });
    }

    const actualizada = await prisma.ordenServicio.update({
      where: { id },
      data: { tecnicoId, estado: 'ASIGNADA', fechaAsignacion: new Date() },
      include: INCLUDE_ORDEN,
    });
    res.json(actualizada);
  } catch (err) {
    console.error('Error en tecnicoPortal.tomarOrden:', err);
    res.status(500).json({ error: 'Error al tomar la orden' });
  }
}

// PATCH /api/tecnico/ordenes/:id/aceptar
async function aceptarOrden(req, res) {
  try {
    const { id } = req.params;
    const tecnicoId = req.tecnico.id;

    const orden = await prisma.ordenServicio.findUnique({ where: { id } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.tecnicoId !== tecnicoId) return res.status(403).json({ error: 'Esta orden no está asignada a ti' });
    if (orden.estado !== 'ASIGNADA') return res.status(400).json({ error: 'La orden no está en estado asignada' });

    const actualizada = await prisma.ordenServicio.update({
      where: { id },
      data: { fechaAceptacion: new Date() },
      include: INCLUDE_ORDEN,
    });
    res.json(actualizada);
  } catch (err) {
    console.error('Error en tecnicoPortal.aceptarOrden:', err);
    res.status(500).json({ error: 'Error al aceptar la orden' });
  }
}

// PATCH /api/tecnico/ordenes/:id/iniciar
async function iniciarOrden(req, res) {
  try {
    const { id } = req.params;
    const tecnicoId = req.tecnico.id;

    const orden = await prisma.ordenServicio.findUnique({ where: { id } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.tecnicoId !== tecnicoId) return res.status(403).json({ error: 'Esta orden no está asignada a ti' });
    if (orden.estado !== 'ASIGNADA') return res.status(400).json({ error: 'La orden no está en estado asignada' });
    if (!orden.fechaAceptacion) return res.status(400).json({ error: 'Primero debes aceptar la orden' });

    const actualizada = await prisma.ordenServicio.update({
      where: { id },
      data: { estado: 'EN_PROCESO', fechaInicio: new Date() },
      include: INCLUDE_ORDEN,
    });
    res.json(actualizada);
  } catch (err) {
    console.error('Error en tecnicoPortal.iniciarOrden:', err);
    res.status(500).json({ error: 'Error al iniciar la orden' });
  }
}

// PATCH /api/tecnico/ordenes/:id/completar
async function completarOrden(req, res) {
  try {
    const { id } = req.params;
    const tecnicoId = req.tecnico.id;
    const {
      latitud, longitud, puntoRedId, equipoProductoId, equipoSerie,
      precinto, comentario, consumos,
    } = req.body;

    const orden = await prisma.ordenServicio.findUnique({ where: { id } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (orden.tecnicoId !== tecnicoId) return res.status(403).json({ error: 'Esta orden no está asignada a ti' });
    if (orden.estado !== 'EN_PROCESO') return res.status(400).json({ error: 'La orden no está en proceso' });

    const esInstalacion = orden.tipoOrden.startsWith('INSTALACION');
    const esCambioEquipo = orden.tipoOrden.startsWith('CAMBIO_EQUIPO');
    const tipoBase = orden.tipoOrden.replace(/_[ICD]$/, '');
    const nuevoEstadoContrato = ESTADO_CONTRATO_POR_TIPO[tipoBase] || null;

    // Misma validación que en el panel admin: la IP WAN y el usuario PPPoE de la
    // orden no pueden chocar con los de otro contrato antes de sincronizarlos.
    if (orden.contratoId && orden.ipWan) {
      const otroPorIp = await prisma.contrato.findFirst({ where: { ipWan: orden.ipWan, id: { not: orden.contratoId } } });
      if (otroPorIp) return res.status(409).json({ error: `La IP WAN ${orden.ipWan} ya está en uso por el contrato ${otroPorIp.numero}` });
    }
    if (orden.contratoId && orden.pppoeUsuario) {
      const otroPorUsuario = await prisma.contrato.findFirst({ where: { pppoeUsuario: orden.pppoeUsuario, id: { not: orden.contratoId } } });
      if (otroPorUsuario) return res.status(409).json({ error: `El usuario PPPoE ${orden.pppoeUsuario} ya está en uso por el contrato ${otroPorUsuario.numero}` });
    }

    const listaConsumos = Array.isArray(consumos) ? consumos.filter(c => c.productoId && Number(c.cantidad) > 0) : [];

    const resultado = await prisma.$transaction(async (tx) => {
      for (const c of listaConsumos) {
        const producto = await tx.producto.findUnique({ where: { id: Number(c.productoId) } });
        if (!producto) throw new Error(`Producto no encontrado`);
        const cantidad = Number(c.cantidad);

        if (producto.esMedible && producto.metrosPorUnidad) {
          // Para productos medibles (rollos), la cantidad ingresada son METROS,
          // no unidades/rollos enteros — se descuenta del pool de metros disponibles.
          if ((producto.metrosDisponibles || 0) < cantidad) {
            throw new Error(`Metros insuficientes de "${producto.nombre}" (disponible: ${producto.metrosDisponibles || 0}m)`);
          }
          await tx.producto.update({ where: { id: producto.id }, data: { metrosDisponibles: { decrement: cantidad } } });
        } else {
          if (producto.stockTotal < cantidad) {
            throw new Error(`Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stockTotal})`);
          }
          await tx.producto.update({ where: { id: producto.id }, data: { stockTotal: { decrement: cantidad } } });
        }

        await tx.ordenConsumo.create({ data: { ordenId: id, productoId: producto.id, cantidad } });
        await tx.movimientoStock.create({
          data: {
            productoId: producto.id,
            tipo: 'SALIDA',
            cantidad,
            motivo: `Consumo en orden ${orden.nServicio}${producto.esMedible ? ' (metros)' : ''}`,
          },
        });
      }

      const dataOrden = {
        estado: 'COMPLETADA',
        fechaFin: new Date(),
        latitud: latitud !== '' && latitud !== undefined && latitud !== null ? Number(latitud) : undefined,
        longitud: longitud !== '' && longitud !== undefined && longitud !== null ? Number(longitud) : undefined,
        precinto: precinto?.trim() || undefined,
        ...(comentario?.trim() ? { observacion: [orden.observacion, comentario.trim()].filter(Boolean).join(' | ') } : {}),
      };

      const ordenActualizada = await tx.ordenServicio.update({ where: { id }, data: dataOrden, include: INCLUDE_ORDEN });
      const fechaInstalacionFinal = new Date();

      if (orden.contratoId && (orden.ipWan || orden.pppoeUsuario)) {
        await tx.contrato.update({
          where: { id: orden.contratoId },
          data: {
            ipWan: orden.ipWan, mascara: orden.mascara, gateway: orden.gateway,
            pppoeUsuario: orden.pppoeUsuario, pppoePassword: orden.pppoePassword,
          },
        });
      }

      if (esInstalacion && orden.contratoId) {
        if (equipoProductoId) await descontarEquipoDeInventario(tx, equipoProductoId);
        await tx.contrato.update({
          where: { id: orden.contratoId },
          data: {
            puntoRedId: puntoRedId || undefined,
            equipoProductoId: equipoProductoId ? Number(equipoProductoId) : undefined,
            equipoSerie: equipoSerie?.trim() || undefined,
            tecnicoInstaladorId: tecnicoId,
            fechaInstalacion: fechaInstalacionFinal,
            precinto: precinto?.trim() || undefined,
            latitud: latitud !== '' && latitud !== undefined && latitud !== null ? Number(latitud) : undefined,
            longitud: longitud !== '' && longitud !== undefined && longitud !== null ? Number(longitud) : undefined,
          },
        });
      } else if (esCambioEquipo && orden.contratoId && (equipoProductoId || equipoSerie?.trim())) {
        if (equipoProductoId) await descontarEquipoDeInventario(tx, equipoProductoId);
        await tx.contrato.update({
          where: { id: orden.contratoId },
          data: {
            equipoProductoId: equipoProductoId ? Number(equipoProductoId) : undefined,
            equipoSerie: equipoSerie?.trim() || undefined,
            precinto: precinto?.trim() || undefined,
          },
        });
      } else if (nuevoEstadoContrato && orden.contratoId) {
        await tx.contrato.update({
          where: { id: orden.contratoId },
          data: { estado: nuevoEstadoContrato, ...(nuevoEstadoContrato === 'CORTADO' ? { fechaCorte: new Date() } : {}) },
        });
      } else if (tipoBase === 'RETIRO_EQUIPO' && orden.contratoId) {
        await tx.contrato.update({
          where: { id: orden.contratoId },
          data: { equipoProductoId: null, equipoSerie: null, precinto: null },
        });
      } else if (tipoBase === 'CAMBIO_PLAN' && orden.contratoId) {
        const planNuevo = orden.planId ? await tx.plan.findUnique({ where: { id: orden.planId } }) : null;
        await tx.contrato.update({
          where: { id: orden.contratoId },
          data: {
            planId: orden.planId || null, mbps: orden.mbps ?? undefined, costoMensual: orden.mensualidad ?? undefined,
            ...(planNuevo ? { tipoServicio: planNuevo.tipoServicio } : {}),
          },
        });
      }

      return { ordenActualizada, esInstalacion, contratoId: orden.contratoId, fechaInstalacionFinal };
    });

    if (resultado.esInstalacion && resultado.contratoId) {
      const contrato = await prisma.contrato.findUnique({ where: { id: resultado.contratoId } });
      if (contrato?.estado === 'ACTIVO') {
        await generarCargoProrrateado(contrato, resultado.fechaInstalacionFinal)
          .catch(err => console.error('Error al generar el cargo prorrateado:', err));
      }
    }

    res.json(resultado.ordenActualizada);
  } catch (err) {
    console.error('Error en tecnicoPortal.completarOrden:', err);
    res.status(400).json({ error: err.message || 'Error al completar la orden' });
  }
}

module.exports = { listarOrdenes, historialOrdenes, obtenerOrden, tomarOrden, aceptarOrden, iniciarOrden, completarOrden };
