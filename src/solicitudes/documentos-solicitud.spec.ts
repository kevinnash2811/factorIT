import { documentosDe } from './solicitudes.service';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';

const base = {
  solicitante: 'Rodrigo Apaza',
  rutaId: 'R01',
  monto: 150000,
  ceco: 'CEBE0099',
} as CrearSolicitudDto;

describe('documentosDe', () => {
  it('toma la lista completa cuando el portal la envía', () => {
    const dto = {
      ...base,
      documentos: [
        { nombre: 'factura.pdf', url: '/documentos/archivos/a.pdf', pesoKb: '120' },
        { nombre: 'boleta.jpg', url: '/documentos/archivos/b.jpg', pesoKb: '80' },
        { nombre: 'respaldo.xlsx', url: '/documentos/archivos/c.xlsx' },
      ],
    } as CrearSolicitudDto;
    const adjuntos = documentosDe(dto);
    expect(adjuntos).toHaveLength(3);
    expect(adjuntos.map((a) => a.nombre)).toEqual(['factura.pdf', 'boleta.jpg', 'respaldo.xlsx']);
  });

  it('acepta el formato antiguo de un solo adjunto', () => {
    const dto = {
      ...base,
      documentoNombre: 'boleta.pdf',
      documentoGcsUri: '/documentos/archivos/x.pdf',
      documentoPesoKb: '90',
    } as CrearSolicitudDto;
    expect(documentosDe(dto)).toEqual([
      { nombre: 'boleta.pdf', url: '/documentos/archivos/x.pdf', pesoKb: '90' },
    ]);
  });

  it('la lista nueva manda sobre el campo antiguo', () => {
    const dto = {
      ...base,
      documentoNombre: 'viejo.pdf',
      documentoGcsUri: '/documentos/archivos/viejo.pdf',
      documentos: [{ nombre: 'nuevo.pdf', url: '/documentos/archivos/nuevo.pdf' }],
    } as CrearSolicitudDto;
    expect(documentosDe(dto).map((a) => a.nombre)).toEqual(['nuevo.pdf']);
  });

  it('sin adjuntos devuelve una lista vacía, no null', () => {
    expect(documentosDe(base)).toEqual([]);
    expect(documentosDe({ ...base, documentos: [] } as CrearSolicitudDto)).toEqual([]);
  });

  it('un adjunto antiguo sin ruta no rompe: queda con url vacía', () => {
    const dto = { ...base, documentoNombre: 'suelto.pdf' } as CrearSolicitudDto;
    expect(documentosDe(dto)).toEqual([
      { nombre: 'suelto.pdf', url: '', pesoKb: undefined },
    ]);
  });
});
