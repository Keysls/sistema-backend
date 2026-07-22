const prisma = require('../src/utils/prisma');

function periodosAtras(n) {
  // Devuelve un array de n períodos 'YYYY-MM' terminando en el mes actual (el más reciente al final)
  const hoy = new Date();
  const periodos = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    periodos.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periodos;
}

const CLIENTES = [
  { dniRuc: '70111111', nombres: 'ROSA', apellidos: 'MENDOZA TORRES', telefono: '944111111', direccion: 'Jr. Los Pinos 210, Trujillo' },
  { dniRuc: '70222222', nombres: 'CARLOS', apellidos: 'VASQUEZ LEON', telefono: '944222222', direccion: 'Av. España 450, Trujillo' },
  { dniRuc: '70333333', nombres: 'PATRICIA', apellidos: 'RUIZ DIAZ', telefono: '944333333', direccion: 'Calle Bolivar 120, Laredo' },
  { dniRuc: '70444444', nombres: 'MIGUEL', apellidos: 'CASTILLO PEÑA', telefono: '944444444', direccion: 'Mz A Lt 5, Huanchaco' },
];

const PLANES_TIPO = ['INTERNET', 'CABLE', 'DUO'];

async function main() {
  const secuenciaBase = 200; // arranca en C00000000200 para no chocar con contratos existentes

  for (let i = 0; i < CLIENTES.length; i++) {
    const datosCliente = CLIENTES[i];
    const cliente = await prisma.cliente.create({
      data: { ...datosCliente, activo: true },
    });

    const mesesDeuda = i < 2 ? 2 : 3; // los dos primeros deben 2 meses, los otros dos deben 3 meses
    const costoMensual = 40 + i * 10; // 40, 50, 60, 70
    const numero = `C${String(secuenciaBase + i).padStart(11, '0')}`;

    const contrato = await prisma.contrato.create({
      data: {
        numero,
        clienteId: cliente.id,
        direccion: datosCliente.direccion,
        tipoServicio: PLANES_TIPO[i % PLANES_TIPO.length],
        estado: 'ACTIVO',
        costoMensual,
        diaCorte: 15,
      },
    });

    const periodos = periodosAtras(mesesDeuda);
    for (const periodo of periodos) {
      const [anio, mes] = periodo.split('-').map(Number);
      await prisma.cargoMensual.create({
        data: {
          contratoId: contrato.id,
          periodo,
          monto: costoMensual,
          vencimiento: new Date(anio, mes - 1, 15),
          estado: 'PENDIENTE',
        },
      });
    }

    console.log(`✔ ${cliente.nombres} ${cliente.apellidos} — contrato ${numero} — debe ${mesesDeuda} mes(es) de S/${costoMensual} = S/${(mesesDeuda * costoMensual).toFixed(2)} (${periodos.join(', ')})`);
  }

  console.log('\nListo. Datos de prueba creados.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
