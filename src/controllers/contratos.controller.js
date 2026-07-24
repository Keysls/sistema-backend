const prisma = require('../utils/prisma');
const { estaVencido } = require('../utils/generarCargos');

const TIPOS_SERVICIO = ['INTERNET', 'CABLE', 'DUO'];
const ESTADOS = ['ACTIVO', 'SUSPENDIDO', 'CORTADO', 'BAJA'];

const INCLUDE_CONTRATO = {
  cliente: { select: { id: true, dniRuc: true, nombres: true, apellidos: true, telefono: true, email: true, direccion: true, latitud: true, longitud: true, activo: true } },
  plan: true,
  puntoRed: { select: { id: true, codigo: true, tipo: true } },
  equipoProducto: { select: { id: true, nombre: true, codigo: true } },
  tecnicoInstalador: { select: { id: true, nombre: true, apellido: true } },
};

// No se puede usar orderBy: 'desc' sobre `numero` para hallar "el último": es un
// campo de texto, así que ordena alfabéticamente y cualquier contrato con un número
// no estándar (ej. importado o de prueba) puede colar como "mayor" que C00000000123
// y reventar el correlativo. Por eso se filtran y comparan solo los que sí siguen
// el formato C########### y se toma el máximo numérico real entre esos.
async function generarNumero() {
  const candidatos = await prisma.contrato.findMany({ where: { numero: { startsWith: 'C' } }, select: { numero: true } });
  let max = 0;
  for (const { numero } of candidatos) {
    if (/^C\d{11}$/.test(numero)) {
      const n = parseInt(numero.slice(1), 10);
      if (n > max) max = n;
    }
  }
  return 'C' + String(max + 1).padStart(11, '0');
}

async function generarNumeroOrden() {
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
        cargos: {
          where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          select: { monto: true, periodo: true, pagos: { select: { monto: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conActividad = data.map(({ ordenes, cargos, ...c }) => {
      const saldos = cargos.map(cg => Number(cg.monto) - cg.pagos.reduce((s, p) => s + Number(p.monto), 0));
      return {
        ...c,
        ultimaActividad: ordenes[0]?.fechaServicio || c.createdAt,
        ultimoTipoOrden: ordenes[0]?.tipoOrden || null,
        deudaPendiente: saldos.reduce((sum, s) => sum + s, 0),
        mesesPendientes: cargos.length,
        deudaVencida: cargos.some(cg => estaVencido(cg.periodo, c.diaCorte)),
      };
    });

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
  const { clienteId, direccion, tipoServicio, estado, diaCorte } = body;
  if (!clienteId) return 'El cliente es requerido';
  if (!direccion?.trim()) return 'La dirección es requerida';
  if (!TIPOS_SERVICIO.includes(tipoServicio)) return 'Tipo de servicio inválido';
  if (estado && !ESTADOS.includes(estado)) return 'Estado inválido';
  const diaCorteNum = Number(diaCorte);
  if (!diaCorte && diaCorte !== 0) return 'El día de corte es requerido';
  if (!Number.isInteger(diaCorteNum) || diaCorteNum < 1 || diaCorteNum > 31) return 'El día de corte debe ser un número entre 1 y 31';
  return null;
}

function armarData(body) {
  const {
    direccion, referencia, sector, tipoServicio, ipWan, mascara, gateway, pppoeUsuario, pppoePassword,
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
    pppoeUsuario: pppoeUsuario?.trim() || null,
    pppoePassword: pppoePassword?.trim() || null,
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

// GET /api/contratos/siguiente-numero  (previsualiza qué número le tocaría al próximo
// contrato — útil para generar el usuario PPPoE antes de guardar. Best-effort: si dos
// personas crean un contrato al mismo tiempo, el número real puede correrse uno más).
async function siguienteNumero(req, res) {
  try {
    const numero = await generarNumero();
    res.json({ numero });
  } catch (err) {
    console.error('Error en contratos.siguienteNumero:', err);
    res.status(500).json({ error: 'Error al previsualizar el número de contrato' });
  }
}

// POST /api/contratos
// Traduce un error de restricción única (P2002) de Prisma a un mensaje entendible,
// según qué campo chocó (numero, ipWan o pppoeUsuario).
function mensajeDuplicado(err) {
  const campo = err.meta?.target?.[0] || err.meta?.target;
  if (campo?.includes('ipWan')) return 'Ya existe otro contrato con esa misma IP WAN';
  if (campo?.includes('pppoeUsuario')) return 'Ya existe otro contrato con ese mismo usuario PPPoE';
  if (campo?.includes('numero')) return 'Ya existe un contrato con ese número';
  return 'Ya existe un contrato con ese dato (debe ser único)';
}

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

    // El cargo prorrateado ya NO se genera aquí: se genera cuando la orden de
    // instalación queda COMPLETADA (ver ordenesServicio.controller.js), tomando
    // como fecha de inicio la fecha real de instalación, no la de creación del contrato.

    res.status(201).json(contrato);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: mensajeDuplicado(err) });
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
    if (err.code === 'P2002') return res.status(409).json({ error: mensajeDuplicado(err) });
    console.error('Error en contratos.actualizar:', err);
    res.status(500).json({ error: 'Error al actualizar el contrato' });
  }
}

// DELETE /api/contratos/:id  (solo ADMIN — borra el contrato y todo lo asociado)
async function eliminar(req, res) {
  try {
    const { id } = req.params;
    const contrato = await prisma.contrato.findUnique({ where: { id } });
    if (!contrato) return res.status(404).json({ error: 'Contrato no encontrado' });

    await prisma.pagoCargo.deleteMany({ where: { cargo: { contratoId: id } } });
    await prisma.cargoMensual.deleteMany({ where: { contratoId: id } });
    await prisma.ordenServicio.deleteMany({ where: { contratoId: id } });
    await prisma.contrato.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error('Error en contratos.eliminar:', err);
    res.status(500).json({ error: 'Error al eliminar el contrato' });
  }
}

// POST /api/contratos/importar  (importación masiva desde la plantilla de Excel)
// body: { filas: [{ contrato, docIdentidad, abonado, direccion, referencia, sector, tipoServicio, nombrePlan, diaCorte, telefono, cintillo, puntoRed }] }
async function importarLote(req, res) {
  const filas = Array.isArray(req.body.filas) ? req.body.filas : [];
  const creados = [];
  const omitidos = [];
  const errores = [];

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const numeroFila = i + 2; // +2: fila 1 es el encabezado en el Excel
    try {
      const numero = String(fila.contrato || '').trim();
      if (!numero) { omitidos.push({ fila: numeroFila, motivo: 'Sin número de contrato' }); continue; }

      const yaExiste = await prisma.contrato.findUnique({ where: { numero } });
      if (yaExiste) { omitidos.push({ fila: numeroFila, motivo: `El contrato ${numero} ya existe` }); continue; }

      const SINONIMOS_SERVICIO = {
        TV: 'CABLE', CATV: 'CABLE', CABLE: 'CABLE',
        INTERNET: 'INTERNET', NET: 'INTERNET',
        DUO: 'DUO', DUAL: 'DUO',
      };
      const tipoServicioCrudo = String(fila.tipoServicio || '').trim().toUpperCase();
      const tipoServicio = SINONIMOS_SERVICIO[tipoServicioCrudo] || tipoServicioCrudo;
      if (!TIPOS_SERVICIO.includes(tipoServicio)) {
        errores.push({ fila: numeroFila, motivo: `Tipo de servicio inválido: "${fila.tipoServicio}"` });
        continue;
      }

      const sectorTrim = String(fila.sector || '').trim();
      const direccion = String(fila.direccion || '').trim() || sectorTrim || 'Sin dirección registrada';

      const abonado = String(fila.abonado || '').trim();
      if (!abonado) { errores.push({ fila: numeroFila, motivo: 'Falta el nombre del abonado' }); continue; }

      const dniRuc = String(fila.docIdentidad || '').trim() || `SINDOC-${numero}`;

      let cliente = await prisma.cliente.findUnique({ where: { dniRuc } });
      if (!cliente) {
        cliente = await prisma.cliente.create({
          data: {
            dniRuc,
            nombres: abonado,
            telefono: String(fila.telefono || '').trim() || null,
            direccion,
            activo: true,
          },
        });
      }

      let plan = null;
      const nombrePlan = String(fila.nombrePlan || '').trim();
      if (nombrePlan) {
        plan = await prisma.plan.findFirst({
          where: { nombre: { equals: nombrePlan, mode: 'insensitive' }, tipoServicio },
        });
      }

      let puntoRed = null;
      const codigoPunto = String(fila.puntoRed || '').trim();
      if (codigoPunto) {
        puntoRed = await prisma.puntoRed.findFirst({ where: { codigo: { equals: codigoPunto, mode: 'insensitive' } } });
      }

      const diaCorte = Number(fila.diaCorte) || null;

      const contrato = await prisma.contrato.create({
        data: {
          numero,
          clienteId: cliente.id,
          direccion,
          referencia: String(fila.referencia || '').trim() || null,
          sector: String(fila.sector || '').trim() || null,
          tipoServicio,
          planId: plan?.id || null,
          mbps: plan?.mbps || null,
          costoMensual: plan?.precio || null,
          diaCorte,
          precinto: String(fila.cintillo || '').trim() || null,
          puntoRedId: puntoRed?.id || null,
          ipWan: String(fila.ipWan || '').trim() || null,
          mascara: String(fila.mascara || '').trim() || null,
          gateway: String(fila.gateway || '').trim() || null,
          pppoeUsuario: String(fila.pppoeUsuario || '').trim() || null,
          pppoePassword: String(fila.pppoePassword || '').trim() || null,
          estado: 'ACTIVO',
        },
      });

      creados.push({ fila: numeroFila, numero: contrato.numero });
    } catch (err) {
      console.error(`Error importando fila ${numeroFila}:`, err);
      errores.push({ fila: numeroFila, motivo: err.code === 'P2002' ? mensajeDuplicado(err) : (err.message || 'Error desconocido') });
    }
  }

  res.json({ totalFilas: filas.length, creados: creados.length, omitidos, errores });
}

module.exports = { listar, listarMapa, obtener, crear, actualizar, eliminar, importarLote, siguienteNumero };
