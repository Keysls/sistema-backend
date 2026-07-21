const prisma = require('../utils/prisma');
const PDFDocument = require('pdfkit');
const { numeroALetras } = require('../utils/numeroALetras');

const METODOS_VALIDOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];
const METODOS_LABEL = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' };
const SERVICIO_LABEL = { INTERNET: 'Internet', CABLE: 'Cable', DUO: 'Dúo' };

const INCLUDE_PAGO = {
  usuario: { select: { id: true, nombre: true, apellido: true } },
  cargos: {
    include: {
      cargo: {
        select: {
          id: true, periodo: true, monto: true, vencimiento: true,
          contrato: {
            select: {
              id: true, numero: true, tipoServicio: true, direccion: true,
              cliente: { select: { nombres: true, apellidos: true, dniRuc: true, telefono: true } },
            },
          },
        },
      },
    },
  },
};

function fmtPeriodoLabel(periodo) {
  const [anio, mes] = periodo.split('-');
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${nombres[Number(mes) - 1]} ${anio}`;
}

// GET /api/pagos?q=&metodoPago=&fechaDesde=&fechaHasta=
async function listar(req, res) {
  try {
    const { q, metodoPago, fechaDesde, fechaHasta } = req.query;
    const where = {
      ...(metodoPago ? { metodoPago } : {}),
      ...(fechaDesde || fechaHasta
        ? { fecha: { ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}), ...(fechaHasta ? { lte: new Date(fechaHasta + 'T23:59:59') } : {}) } }
        : {}),
      ...(q
        ? {
            cargos: {
              some: {
                cargo: {
                  contrato: {
                    OR: [
                      { numero: { contains: q, mode: 'insensitive' } },
                      { cliente: { nombres: { contains: q, mode: 'insensitive' } } },
                      { cliente: { apellidos: { contains: q, mode: 'insensitive' } } },
                      { cliente: { dniRuc: { contains: q, mode: 'insensitive' } } },
                    ],
                  },
                },
              },
            },
          }
        : {}),
    };

    const data = await prisma.pago.findMany({ where, include: INCLUDE_PAGO, orderBy: { fecha: 'desc' } });
    res.json(data);
  } catch (err) {
    console.error('Error en pagos.listar:', err);
    res.status(500).json({ error: 'Error al listar los pagos' });
  }
}

// POST /api/pagos
async function crear(req, res) {
  try {
    const { contratoId, fecha, metodoPago, cargoIds, observacion } = req.body;

    if (!contratoId) return res.status(400).json({ error: 'El contrato es requerido' });
    if (!fecha) return res.status(400).json({ error: 'La fecha de pago es requerida' });
    if (!METODOS_VALIDOS.includes(metodoPago)) return res.status(400).json({ error: 'Método de pago inválido' });
    if (!Array.isArray(cargoIds) || cargoIds.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un período (mes) a pagar' });
    }

    const cargos = await prisma.cargoMensual.findMany({
      where: { id: { in: cargoIds }, contratoId, estado: 'PENDIENTE' },
    });

    if (cargos.length !== cargoIds.length) {
      return res.status(409).json({ error: 'Alguno de los períodos seleccionados ya fue pagado o no existe. Actualiza la página e intenta de nuevo.' });
    }

    const montoTotal = cargos.reduce((sum, c) => sum + Number(c.monto), 0);

    const pago = await prisma.$transaction(async (tx) => {
      const nuevoPago = await tx.pago.create({
        data: {
          fecha: new Date(fecha),
          monto: montoTotal,
          metodoPago,
          observacion: observacion?.trim() || null,
          usuarioId: req.usuario.id,
        },
      });

      for (const c of cargos) {
        await tx.pagoCargo.create({ data: { pagoId: nuevoPago.id, cargoId: c.id, monto: c.monto } });
        await tx.cargoMensual.update({ where: { id: c.id }, data: { estado: 'PAGADO' } });
      }

      return tx.pago.findUnique({ where: { id: nuevoPago.id }, include: INCLUDE_PAGO });
    });

    res.status(201).json(pago);
  } catch (err) {
    console.error('Error en pagos.crear:', err);
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
}

function fmtFechaCorta(f) {
  return new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function rangoPeriodo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number);
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0);
  return { inicio: fmtFechaCorta(inicio), fin: fmtFechaCorta(fin) };
}

// GET /api/pagos/:id/comprobante
async function comprobante(req, res) {
  try {
    const { id } = req.params;
    const [pago, empresa, correlativo] = await Promise.all([
      prisma.pago.findUnique({ where: { id }, include: INCLUDE_PAGO }),
      prisma.empresa.findFirst(),
      prisma.pago.count(),
    ]);
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' });

    const primerCargo = pago.cargos[0]?.cargo;
    const contrato = primerCargo?.contrato;
    const cliente = contrato?.cliente;

    const monto = Number(pago.monto);
    const subTotal = monto / 1.18;
    const igv = monto - subTotal;
    const numeroComprobante = `${String(correlativo).padStart(5, '0')}-${pago.id.replace(/-/g, '').slice(0, 7).toUpperCase()}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="comprobante_${pago.id.slice(0, 8)}.pdf"`);

    const doc = new PDFDocument({ size: 'A5', margin: 32 });
    doc.pipe(res);

    const anchoUtil = doc.page.width - 64;
    const bordeX = 22, bordeY = 22;
    const linea = () => { doc.strokeColor('#000').lineWidth(0.5).moveTo(32, doc.y).lineTo(doc.page.width - 32, doc.y).stroke(); doc.moveDown(0.5); };

    // ── Encabezado ──
    if (empresa?.logo) {
      try {
        const base64Data = empresa.logo.replace(/^data:image\/\w+;base64,/, '');
        const logoBuffer = Buffer.from(base64Data, 'base64');
        const cajaLogo = 72;
        const xLogo = (doc.page.width - cajaLogo) / 2;
        const yLogo = doc.y;
        doc.image(logoBuffer, xLogo, yLogo, { fit: [cajaLogo, cajaLogo], align: 'center', valign: 'center' });
        doc.y = yLogo + cajaLogo + 6;
      } catch (e) {
        console.error('No se pudo insertar el logo:', e.message);
      }
    }

    doc.fontSize(15).font('Helvetica-Bold').fillColor('#000').text(empresa?.nombre || 'Mi Empresa', { align: 'center' });
    if (empresa?.ruc) doc.fontSize(11).font('Helvetica-Bold').text(empresa.ruc, { align: 'center' });
    doc.moveDown(0.5);

    if (empresa?.agencia) {
      doc.fontSize(9).font('Helvetica-Bold').text(empresa.agencia, { align: 'center' });
    }
    if (empresa?.direccion) {
      doc.fontSize(8.5).font('Helvetica').text(empresa.direccion, { align: 'center' });
    }
    if (empresa?.telefono) {
      doc.fontSize(8.5).font('Helvetica').text(empresa.telefono, { align: 'center' });
    }
    doc.moveDown(0.6);

    doc.fontSize(12).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').text(numeroComprobante, { align: 'center' });
    doc.moveDown(0.6);
    linea();

    // ── Datos del pago ──
    doc.fontSize(9).font('Helvetica');
    const fechaObj = new Date(pago.fecha);
    doc.font('Helvetica-Bold').text('Fecha: ', { continued: true }).font('Helvetica').text(fmtFechaCorta(fechaObj), { continued: true, width: anchoUtil / 2 });
    doc.font('Helvetica-Bold').text('  Hora: ', { continued: true }).font('Helvetica').text(fechaObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').text('Cliente: ', { continued: true }).font('Helvetica').text(`${cliente?.nombres || ''} ${cliente?.apellidos || ''}`.trim());
    doc.font('Helvetica-Bold').text('Dni/Ruc: ', { continued: true }).font('Helvetica').text(cliente?.dniRuc || '—');
    doc.font('Helvetica-Bold').text('Dirección: ', { continued: true }).font('Helvetica').text(contrato?.direccion || '—');
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').text('Forma: ', { continued: true }).font('Helvetica').text(METODOS_LABEL[pago.metodoPago]);
    doc.moveDown(0.6);
    linea();

    // ── Tabla de conceptos ──
    doc.font('Helvetica-Bold').fontSize(9);
    const colDescX = 32, colImpX = doc.page.width - 32 - 60;
    doc.text('Descripción', colDescX, doc.y, { continued: false });
    doc.text('Importe', colImpX, doc.y - doc.currentLineHeight(), { width: 60, align: 'right' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9);

    pago.cargos.forEach(pc => {
      const servicio = SERVICIO_LABEL[contrato?.tipoServicio] || '';
      const { inicio, fin } = rangoPeriodo(pc.cargo.periodo);
      const [, mesNum] = pc.cargo.periodo.split('-');
      const nombresMes = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const desc = `Mensualidad ${nombresMes[Number(mesNum) - 1].toUpperCase()}, del ${inicio} Al ${fin} (${servicio})`;
      const yInicio = doc.y;
      doc.text(desc, colDescX, yInicio, { width: colImpX - colDescX - 8 });
      const yTrasDesc = doc.y;
      doc.text(`${Number(pc.monto).toFixed(2)}`, colImpX, yInicio, { width: 60, align: 'right' });
      doc.y = Math.max(yTrasDesc, yInicio + doc.currentLineHeight());
      doc.moveDown(0.2);
    });

    doc.moveDown(0.4);
    linea();

    // ── Totales ──
    doc.font('Helvetica-Bold').fontSize(9).text(`Son: ${numeroALetras(monto)}`, 32, doc.y, { width: anchoUtil });
    doc.moveDown(0.4);

    const filaTotal = (label, valor, negrita) => {
      doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(label, colDescX, doc.y, { continued: true, width: colImpX - colDescX - 8 })
        .text(`${valor.toFixed(2)}`, { align: 'right' });
    };
    filaTotal('Sub Total:', subTotal, true);
    filaTotal('IGV:', igv, true);
    filaTotal('Total:', monto, true);

    doc.moveDown(1);
    doc.font('Helvetica').fontSize(10).text('Gracias por su preferencia!', { align: 'center' });

    doc.moveDown(0.8);
    doc.fontSize(6.5).fillColor('#999').text(
      'Documento referencial, no válido ante SUNAT como comprobante electrónico.',
      { align: 'center' }
    );

    // ── Borde del ticket ──
    const yFinBox = doc.y + 10;
    doc.rect(bordeX, bordeY, doc.page.width - bordeX * 2, yFinBox - bordeY).lineWidth(1).strokeColor('#000').stroke();

    doc.end();
  } catch (err) {
    console.error('Error en pagos.comprobante:', err);
    res.status(500).json({ error: 'Error al generar el comprobante' });
  }
}

// GET /api/pagos/reporte?fechaDesde=&fechaHasta=
async function reporte(req, res) {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const whereFecha = (fechaDesde || fechaHasta)
      ? { gte: fechaDesde ? new Date(fechaDesde) : undefined, lte: fechaHasta ? new Date(fechaHasta + 'T23:59:59') : undefined }
      : undefined;

    const [pagos, egresos] = await Promise.all([
      prisma.pago.findMany({ where: whereFecha ? { fecha: whereFecha } : {}, select: { monto: true, metodoPago: true } }),
      prisma.egreso.findMany({ where: whereFecha ? { fecha: whereFecha } : {}, select: { monto: true } }),
    ]);

    const porMetodo = METODOS_VALIDOS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {});
    let totalIngresos = 0;
    for (const p of pagos) {
      const monto = Number(p.monto);
      porMetodo[p.metodoPago] = (porMetodo[p.metodoPago] || 0) + monto;
      totalIngresos += monto;
    }

    const totalEgresos = egresos.reduce((acc, e) => acc + Number(e.monto), 0);

    res.json({
      porMetodo,
      totalIngresos,
      totalEgresos,
      saldoNeto: totalIngresos - totalEgresos,
      cantidadPagos: pagos.length,
      cantidadEgresos: egresos.length,
    });
  } catch (err) {
    console.error('Error en pagos.reporte:', err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
}

module.exports = { listar, crear, comprobante, reporte };
