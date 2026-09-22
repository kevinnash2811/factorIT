import {
  aCsv,
  escaparCelda,
  esFormatoValido,
  extensionDe,
  opcionesDe,
  tipoDeContenido,
} from './exportacion.util';

describe('escaparCelda', () => {
  it('deja intacto lo que no necesita comillas', () => {
    expect(escaparCelda('Rodrigo Apaza', ';')).toBe('Rodrigo Apaza');
    expect(escaparCelda(1500000, ';')).toBe('1500000');
  });

  it('entrecomilla cuando el valor trae el separador', () => {
    expect(escaparCelda('Pago; urgente', ';')).toBe('"Pago; urgente"');
    // Con separador coma, el punto y coma deja de ser un problema.
    expect(escaparCelda('Pago; urgente', ',')).toBe('Pago; urgente');
  });

  it('duplica las comillas internas', () => {
    expect(escaparCelda('Factura "A-12"', ';')).toBe('"Factura ""A-12"""');
  });

  it('entrecomilla los saltos de línea para no partir la fila', () => {
    expect(escaparCelda('Linea 1\nLinea 2', ';')).toBe('"Linea 1\nLinea 2"');
  });

  it('neutraliza los valores que Excel tomaría como fórmula', () => {
    expect(escaparCelda('=1+1', ';')).toBe("'=1+1");
    expect(escaparCelda('@SUM(A1)', ';')).toBe("'@SUM(A1)");
  });

  it('convierte lo vacío en celda vacía', () => {
    expect(escaparCelda(null, ';')).toBe('');
    expect(escaparCelda(undefined, ';')).toBe('');
  });
});

describe('aCsv', () => {
  const encabezados = ['ID', 'Colaborador', 'Monto (CLP)'];
  const filas = [['5527F9BB', 'Rodrigo Apaza', 1500000]];

  it('arma el archivo para Excel con BOM y punto y coma', () => {
    const csv = aCsv(encabezados, filas, opcionesDe('csv'));
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('ID;Colaborador;Monto (CLP)');
    expect(csv).toContain('5527F9BB;Rodrigo Apaza;1500000');
  });

  it('arma la variante internacional con coma y sin BOM', () => {
    const csv = aCsv(encabezados, filas, opcionesDe('csv-coma'));
    expect(csv.startsWith('﻿')).toBe(false);
    expect(csv).toContain('ID,Colaborador,Monto (CLP)');
  });

  it('separa las filas con el fin de línea que espera Excel', () => {
    const csv = aCsv(encabezados, filas, opcionesDe('csv'));
    expect(csv.split('\r\n')).toHaveLength(2);
  });

  it('mantiene el número de columnas aunque haya celdas vacías', () => {
    const csv = aCsv(encabezados, [['X', null, undefined]], opcionesDe('csv'));
    const ultimaLinea = csv.split('\r\n')[1];
    expect(ultimaLinea.split(';')).toHaveLength(3);
    expect(ultimaLinea).toBe('X;;');
  });
});

describe('formatos', () => {
  it('acepta solo los formatos conocidos', () => {
    expect(esFormatoValido('xlsx')).toBe(true);
    expect(esFormatoValido('csv')).toBe(true);
    expect(esFormatoValido('csv-coma')).toBe(true);
    expect(esFormatoValido('pdf')).toBe(false);
    expect(esFormatoValido(undefined)).toBe(false);
  });

  it('resuelve el tipo de contenido y la extensión', () => {
    expect(tipoDeContenido('xlsx')).toContain('spreadsheetml');
    expect(tipoDeContenido('csv')).toBe('text/csv; charset=utf-8');
    expect(extensionDe('xlsx')).toBe('xlsx');
    expect(extensionDe('csv-coma')).toBe('csv');
  });
});
