import { DriveService } from './drive.service';
import {
  esNativoDeGoogle,
  idDesdeEnlace,
  nombreSeguro,
  planDeDescarga,
  validarSeleccion,
} from './drive-archivos.util';

describe('planDeDescarga', () => {
  it('descarga tal cual un archivo subido a Drive', () => {
    const r = planDeDescarga({
      id: 'abc123def456',
      nombre: 'Factura 8874.pdf',
      mimeType: 'application/pdf',
    });

    expect('plan' in r).toBe(true);
    if (!('plan' in r)) return;
    expect(r.plan.url).toContain('alt=media');
    expect(r.plan.nombre).toBe('Factura 8874.pdf');
    expect(r.plan.convertido).toBe(false);
  });

  it('convierte un Documento de Google a PDF', () => {
    const r = planDeDescarga({
      id: 'abc123def456',
      nombre: 'Memo de respaldo',
      mimeType: 'application/vnd.google-apps.document',
    });

    expect('plan' in r).toBe(true);
    if (!('plan' in r)) return;
    expect(r.plan.url).toContain('/export');
    expect(r.plan.url).toContain(encodeURIComponent('application/pdf'));
    expect(r.plan.nombre).toBe('Memo de respaldo.pdf');
    expect(r.plan.convertido).toBe(true);
  });

  it('convierte una Hoja de cálculo de Google a Excel', () => {
    const r = planDeDescarga({
      id: 'abc123def456',
      nombre: 'Rendición septiembre',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    });

    if (!('plan' in r)) throw new Error('debía poder convertirse');
    expect(r.plan.nombre).toBe('Rendición septiembre.xlsx');
    expect(r.plan.extension).toBe('.xlsx');
  });

  it('explica por qué un formulario de Google no se puede adjuntar', () => {
    const r = planDeDescarga({
      id: 'abc123def456',
      nombre: 'Encuesta',
      mimeType: 'application/vnd.google-apps.form',
    });

    expect('error' in r).toBe(true);
    if (!('error' in r)) return;
    expect(r.error).toContain('Descárgalo como PDF');
  });

  it('rechaza un tipo de archivo que no aceptamos', () => {
    const r = planDeDescarga({
      id: 'abc123def456',
      nombre: 'respaldo.zip',
      mimeType: 'application/zip',
    });

    expect('error' in r).toBe(true);
    if (!('error' in r)) return;
    expect(r.error).toContain('no es un tipo de archivo permitido');
  });

  it('deduce la extensión cuando el nombre no la trae', () => {
    const r = planDeDescarga({
      id: 'abc123def456',
      nombre: 'Comprobante sin extensión',
      mimeType: 'image/png',
    });

    if (!('error' in r)) {
      expect(r.plan.nombre).toBe('Comprobante sin extensión.png');
      expect(r.plan.extension).toBe('.png');
    }
  });

  it('limpia del nombre lo que no puede ir en un archivo', () => {
    expect(nombreSeguro('fac/tura:8874*.pdf')).toBe('factura8874.pdf');
    expect(nombreSeguro('..\\..\\secreto.pdf')).toBe('.secreto.pdf');
    expect(nombreSeguro('')).toBe('documento');
  });

  it('reconoce los documentos nativos de Google', () => {
    expect(esNativoDeGoogle('application/vnd.google-apps.document')).toBe(true);
    expect(esNativoDeGoogle('application/pdf')).toBe(false);
  });
});

describe('validarSeleccion', () => {
  const archivo = (n: number) => ({
    id: `id${n}`,
    nombre: `a${n}.pdf`,
    mimeType: 'application/pdf',
  });

  it('acepta hasta cinco archivos', () => {
    expect(validarSeleccion([1, 2, 3, 4, 5].map(archivo))).toBeNull();
  });

  it('rechaza más de cinco', () => {
    expect(validarSeleccion([1, 2, 3, 4, 5, 6].map(archivo))).toContain(
      'hasta 5 archivos',
    );
  });

  it('rechaza una selección vacía', () => {
    expect(validarSeleccion([])).toContain('No se eligió ningún archivo');
  });
});

describe('idDesdeEnlace', () => {
  it('reconoce el enlace de un archivo', () => {
    expect(
      idDesdeEnlace('https://drive.google.com/file/d/1a2B3c4D5e6F7g8H/view?usp=sharing'),
    ).toBe('1a2B3c4D5e6F7g8H');
  });

  it('reconoce el enlace de un documento', () => {
    expect(
      idDesdeEnlace('https://docs.google.com/document/d/1a2B3c4D5e6F7g8H/edit'),
    ).toBe('1a2B3c4D5e6F7g8H');
  });

  it('reconoce el formato con id como parámetro', () => {
    expect(idDesdeEnlace('https://drive.google.com/open?id=1a2B3c4D5e6F7g8H')).toBe(
      '1a2B3c4D5e6F7g8H',
    );
  });

  it('no acepta un enlace que no sea de Drive', () => {
    expect(idDesdeEnlace('https://ejemplo.cl/archivo.pdf')).toBeNull();
    expect(idDesdeEnlace('')).toBeNull();
  });
});

describe('DriveService.copiar', () => {
  const servicio = new DriveService();
  const original = global.fetch;

  afterEach(() => {
    global.fetch = original;
    jest.restoreAllMocks();
  });

  /** Reemplaza a Google: responde lo que le digamos, sin salir a la red. */
  const googleResponde = (respuestas: Array<Partial<Response> & { cuerpo?: Buffer }>) => {
    let i = 0;
    global.fetch = jest.fn(async () => {
      const r = respuestas[Math.min(i++, respuestas.length - 1)];
      return {
        ok: r.ok ?? true,
        status: r.status ?? 200,
        arrayBuffer: async () =>
          (r.cuerpo ?? Buffer.from('contenido de prueba')).buffer,
      } as unknown as Response;
    }) as unknown as typeof fetch;
  };

  it('copia el archivo y devuelve su nombre, ruta y peso', async () => {
    googleResponde([{ ok: true, cuerpo: Buffer.alloc(2048, 7) }]);
    jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);

    const r = await servicio.copiar(
      [{ id: 'abc123def456', nombre: 'Factura.pdf', mimeType: 'application/pdf' }],
      'token-de-prueba',
    );

    expect(r.items).toHaveLength(1);
    expect(r.items[0].nombre).toBe('Factura.pdf');
    expect(r.items[0].url).toMatch(/^\/documentos\/archivos\/[0-9a-f-]+\.pdf$/);
    expect(r.items[0].pesoKb).toBe('2.0');
    expect(r.rechazados).toHaveLength(0);
  });

  it('separa los que no se pudieron traer sin perder los que sí', async () => {
    googleResponde([{ ok: true, cuerpo: Buffer.alloc(1024) }]);
    jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);

    const r = await servicio.copiar(
      [
        { id: 'abc123def456', nombre: 'Factura.pdf', mimeType: 'application/pdf' },
        { id: 'xyz789ghi012', nombre: 'Encuesta', mimeType: 'application/vnd.google-apps.form' },
      ],
      'token-de-prueba',
    );

    expect(r.items).toHaveLength(1);
    expect(r.rechazados).toHaveLength(1);
    expect(r.rechazados[0].nombre).toBe('Encuesta');
  });

  it('avisa en palabras del usuario cuando Google no autoriza', async () => {
    googleResponde([{ ok: false, status: 403 }]);

    await expect(
      servicio.copiar(
        [{ id: 'abc123def456', nombre: 'Factura.pdf', mimeType: 'application/pdf' }],
        'token-vencido',
      ),
    ).rejects.toThrow();

    try {
      await servicio.copiar(
        [{ id: 'abc123def456', nombre: 'Factura.pdf', mimeType: 'application/pdf' }],
        'token-vencido',
      );
    } catch (e) {
      const cuerpo = (e as { getResponse: () => { detalle: string } }).getResponse();
      expect(cuerpo.detalle).toContain('Vuelve a elegir el archivo');
    }
  });

  it('rechaza un archivo que supera el máximo de 10 MB', async () => {
    googleResponde([{ ok: true, cuerpo: Buffer.alloc(11 * 1024 * 1024) }]);

    try {
      await servicio.copiar(
        [{ id: 'abc123def456', nombre: 'Escaneo.pdf', mimeType: 'application/pdf' }],
        'token-de-prueba',
      );
      throw new Error('debía rechazarlo');
    } catch (e) {
      const cuerpo = (e as { getResponse: () => { detalle: string } }).getResponse();
      expect(cuerpo.detalle).toContain('Escaneo.pdf');
    }
  });
});
