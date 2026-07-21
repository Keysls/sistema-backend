const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DECENAS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DIEZS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function seccionATexto(n) {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  let texto = '';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) texto += CENTENAS[c] + ' ';
  if (resto >= 10 && resto < 20) {
    texto += DECENAS[resto - 10];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d >= 2) {
      texto += DIEZS[d];
      if (u > 0) texto += (d === 2 ? 'I' : ' Y ') + UNIDADES[u];
    } else if (u > 0) {
      texto += UNIDADES[u];
    }
  }
  return texto.trim();
}

function enterosATexto(n) {
  if (n === 0) return 'CERO';
  if (n === 1) return 'UNO';

  let texto = '';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;

  if (millones > 0) {
    texto += (millones === 1 ? 'UN MILLON ' : `${enterosATexto(millones)} MILLONES `);
  }
  if (miles > 0) {
    texto += (miles === 1 ? 'MIL ' : `${seccionATexto(miles)} MIL `);
  }
  if (resto > 0) {
    texto += seccionATexto(resto);
  }
  return texto.trim();
}

function numeroALetras(monto) {
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  const centavosStr = String(centavos).padStart(2, '0');
  return `${enterosATexto(entero)} CON ${centavosStr}/100 SOLES`;
}

module.exports = { numeroALetras };
