const prisma = require('../utils/prisma');

const TIPOS_SERVICIO = ['INTERNET', 'CABLE', 'DUO'];
const ESTADOS = ['ACTIVO', 'SUSPENDIDO', 'CORTADO', 'BAJA'];

const INCLUDE_CONTRATO = {
  cliente: { select: { id: true, dniRuc: true, nombres: true, apellidos: true, telefono: true, email: true, direccion: true, latitud: true, longitud: true, activo: true } },
  plan: true,
  puntoRed: { select: { id: true, codigo: true, tipo: true } },
  equipoProducto: { select: { id: true, nombre: true, codigo: true } },
  tecnicoInstalador: { select: { id: true, nombre: true, apellido: true } },
};

async function generarNumero() {
  const ultimo = await prisma.contrato.findFirst({ orderBy: { numero: 'desc' } });
  const ultimoNum = ultimo ? parseInt(ultimo.numero.replace(/^C/, ''), 10) : 0;
  const siguiente = (ultimoNum || 0) + 1;
  return 'C' + String(siguiente).padStart(11, '0');
}

async function generarNumeroOrden() {
  const ultimo = await prisma.ordenServicio.findFirst({ orderBy: { nServicio: 'desc' } });
  const ultimoNum = ultimo ? parseInt(ultimo.nServicio.replace(/^OS/, ''), 10) : 0;
  const siguiente = (ultimoNum || 0) + 1;
  return 'OS' + String(siguiente).padStart(10, '0');
}

const SUFIJO_SERVICIO = { INTERNET: 'I', CABLE: 'C', DUO: 'D' };

async function crearOrdenInstalacion(contrato) {
  const nServicio = await generarNumeroOrden();
  const sufijo = SUFIJO_SERVICIO[contrato.tipoServicio];
  await prisma.ordenServicio.create({
    data: {
      nServicio,
      contratoId: contrato.id,
      tipoOrden: `INSTALACION_${sufijo}`,
      fechaServicio: new Date(),
      abonado: `${contrato.cliente.nombres} ${contrato.cliente.apellidos || ''}`.trim(),
      dni: contrato.cliente.dniRuc,
      direccion: contrato.direccion,
      referencia: contrato.referencia,
      sector: contrato.sector,
      celular: contrato.cliente.telefono,
      ipWan: contrato.ipWan,
      mascara: contrato.mascara,
      gateway: contrato.gateway,
      mensualidad: contrato.costoMensual,
      mbps: contrato.mbps,
      planId: contrato.planId,
    },
  });
}

// GET /api/contratos?q=&estado=&tipoServicio=
async function listar(req, res) {
  try {
    const { q, estado, tipoServicio } = req.query;
    const where = {
      ...(estado ? { estado } : {}),
      ...(tipoServicio ? { tipoServicio } : {}),
      ...(q
        ? {
            OR: [
              { numero: { contains: q, mode: 'insensitive' } },
              { direccion: { contains: q, mode: 'insensitive' } },
              { sector: { contains: q, mode: 'insensitive' } },
              { cliente: { nombres: { contains: q, mode: 'insensitive' } } },
              { cliente: { apellidos: { contains: q, mode: 'insensitive' } } },
              { cliente: { dniRuc: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const data = await prisma.contrato.findMany({
      where,
      include: {
        ...INCLUDE_CONTRATO,
        ordenes: { orderBy: { fechaServicio: 'desc' }, take: 1, select: { fechaServicio: true, tipoOrden: true } },
        cargos: { where: { estado: 'PENDIENTE' }, select: { monto: true, periodo: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const periodoActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    const conActividad = data.map(({ ordenes, cargos, ...c }) => ({
      ...c,
      ultimaActividad: ordenes[0]?.fechaServicio || c.createdAt,
      ultimoTipoOrden: ordenes[0]?.tipoOrden || null,
      deudaPendiente: cargos.reduce((sum, cg) => sum + Number(cg.monto), 0),
      mesesPendientes: cargos.length,
      deudaVencida: cargos.some(cg => cg.periodo < periodoActual),
    }));

    res.json(conActividad);
  } catch (err) {
    console.error('Error en contratos.listar:', err);
    res.status(500).json({ error: 'Error al listar contratos' });
  }
}

// GET /api/contratos/:id (detalle con historial de órdenes)
async function obtener(req, res) {
  try {
    const { id } = req.params;
    const contrato = await prisma.contrato.findUnique({
      where: { id },
      include: {
        ...INCLUDE_CONTRATO,
        ordenes: {
          orderBy: { fechaServicio: 'desc' },
          include: { tecnico: { select: { id: true, nombre: true, apellido: true } } },
        },
        cargos: {
          orderBy: { periodo: 'desc' },
          include: {
            pagos: {
              include: {
                pago: {
                  select: {
                    id: true, fecha: true, metodoPago: true,
                    usuario: { select: { nombre: true, apellido: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado' });

    res.json(contrato);
  } catch (err) {
    console.error('Error en contratos.obtener:', err);
    res.status(500).json({ error: 'Error al obtener el contrato' });
  }
}

// GET /api/contratos/mapa (solo contratos con coordenadas)
async function listarMapa(req, res) {
  try {
    const data = await prisma.contrato.findMany({
      where: { latitud: { not: null }, longitud: { not: null } },
      include: INCLUDE_CONTRATO,
    });
    res.json(data);
  } catch (err) {
    console.error('Error en contratos.listarMapa:', err);
    res.status(500).json({ error: 'Error al listar contratos del mapa' });
  }
}

function validarPayload(body) {
  const { clienteId, direccion, tipoServicio, estado } = body;
  if (!clienteId) return 'El cliente es requerido';
  if (!direccion?.trim()) return 'La dirección es requerida';
  if (!TIPOS_SERVICIO.includes(tipoServicio)) return 'Tipo de servicio inválido';
  if (estado && !ESTADOS.includes(estado)) return 'Estado inválido';
  return null;
}

function armarData(body) {
  const {
    direccion, referencia, sector, tipoServicio, ipWan, mascara, gateway,
    latitud, longitud, precinto, planId, mbps, costoMensual, diaCorte,
    puntoRedId, equipoProductoId, equipoSerie, tecnicoInstaladorId, fechaInstalacion,
    estado, motivoBaja, fechaBaja,
  } = body;

  return {
    direccion: direccion.trim(),
    referencia: referencia?.trim() || null,
    sector: sector?.trim() || null,
    tipoServicio,
    ipWan: ipWan?.trim() || null,
    mascara: mascara?.trim() || null,
    gateway: gateway?.trim() || null,
    latitud: latitud !== '' && latitud !== undefined && latitud !== null ? Number(latitud) : null,
    longitud: longitud !== '' && longitud !== undefined && longitud !== null ? Number(longitud) : null,
    precinto: precinto?.trim() || null,
    planId: planId || null,
    mbps: mbps !== '' && mbps !== undefined && mbps !== null ? Number(mbps) : null,
    costoMensual: costoMensual !== '' && costoMensual !== undefined && costoMensual !== null ? Number(costoMensual) : null,
    diaCorte: diaCorte !== '' && diaCorte !== undefined && diaCorte !== null ? Number(diaCorte) : null,
    puntoRedId: puntoRedId || null,
    equipoProductoId: equipoProductoId ? Number(equipoProductoId) : null,
    equipoSerie: equipoSerie?.trim() || null,
    tecnicoInstaladorId: tecnicoInstaladorId || null,
    fechaInstalacion: fechaInstalacion ? new Date(fechaInstalacion) : null,
    ...(estado ? { estado } : {}),
    motivoBaja: motivoBaja?.trim() || null,
    fechaBaja: fechaBaja ? new Date(fechaBaja) : null,
  };
}

// POST /api/contratos
async function crear(req, res) {
  try {
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const numero = await generarNumero();

    const contrato = await prisma.contrato.create({
      data: {
        numero,
        clienteId: req.body.clienteId,
        ...armarData(req.body),
      },
      include: INCLUDE_CONTRATO,
    });

    await crearOrdenInstalacion(contrato);

    res.status(201).json(contrato);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un contrato con ese número' });
    console.error('Error en contratos.crear:', err);
    res.status(500).json({ error: 'Error al crear el contrato' });
  }
}

// PUT /api/contratos/:id
async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const error = validarPayload(req.body);
    if (error) return res.status(400).json({ error });

    const contrato = await prisma.contrato.update({
      where: { id },
      data: {
        clienteId: req.body.clienteId,
        ...armarData(req.body),
      },
      include: INCLUDE_CONTRATO,
    });

    res.json(contrato);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Contrato no encontrado' });
    console.error('Error en contratos.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el contrato' });
  }
}

module.exports = { listar, listarMapa, obtener, crear, actualizar };
