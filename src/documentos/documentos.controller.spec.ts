import {
  esNombreDeArchivoValido,
  nombreParaDescarga,
} from './documentos.controller';

const UUID = '3f2b7c1a-9d4e-4b8a-9c2f-1a2b3c4d5e6f';

describe('esNombreDeArchivoValido', () => {
  it('acepta el nombre que genera el servidor', () => {
    expect(esNombreDeArchivoValido(`${UUID}.pdf`)).toBe(true);
    expect(esNombreDeArchivoValido(`${UUID}.jpeg`)).toBe(true);
  });

  it('rechaza intentos de salir de la carpeta de subidas', () => {
    for (const intento of [
      '../.env',
      `../../uploads/${UUID}.pdf`,
      `uploads/${UUID}.pdf`,
      `${UUID}.pdf/../../.env`,
    ]) {
      expect(esNombreDeArchivoValido(intento)).toBe(false);
    }
  });

  it('rechaza cualquier nombre que no tenga el formato interno', () => {
    for (const intento of [
      'factura.pdf',
      UUID,
      `${UUID}.`,
      '',
      `${UUID}.demasiadolargo`,
    ]) {
      expect(esNombreDeArchivoValido(intento)).toBe(false);
    }
  });
});

describe('nombreParaDescarga', () => {
  it('conserva el nombre original del documento', () => {
    expect(nombreParaDescarga('Factura 1234.pdf', 'x.pdf')).toBe(
      'Factura 1234.pdf',
    );
  });

  it('quita lo que rompería la cabecera o la ruta', () => {
    expect(nombreParaDescarga('fac"tura/../\\nota.pdf', 'x.pdf')).toBe(
      'factura.nota.pdf',
    );
  });

  it('usa el nombre interno cuando no viene nada utilizable', () => {
    expect(nombreParaDescarga(undefined, `${UUID}.pdf`)).toBe(`${UUID}.pdf`);
    expect(nombreParaDescarga('   ', `${UUID}.pdf`)).toBe(`${UUID}.pdf`);
    expect(nombreParaDescarga('///', `${UUID}.pdf`)).toBe(`${UUID}.pdf`);
  });

  it('recorta los nombres desmedidos', () => {
    expect(nombreParaDescarga('a'.repeat(300), 'x.pdf')).toHaveLength(120);
  });
});
