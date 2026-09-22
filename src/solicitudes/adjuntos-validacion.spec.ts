import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';

/**
 * Las mismas opciones que el ValidationPipe global de main.ts. Sin ellas la
 * prueba no reproduce el error real: `forbidNonWhitelisted` es justamente lo
 * que rechazaba cada propiedad de los adjuntos cuando llegaban como objetos
 * planos en vez de instancias del DTO.
 */
const OPCIONES = { whitelist: true, forbidNonWhitelisted: true };

const solicitudBase = {
  solicitante: 'Kevin Torrez',
  rutaId: 'R01',
  monto: 1500000,
  ceco: 'CEFI0009',
  medioPago: 'TRANSFERENCIA',
  bancoNombre: 'BANCO DE CHILE',
  bancoTipoCuenta: 'Corriente',
  bancoNroCuenta: '111000',
  bancoRutTitular: '11111111-1',
};

const adjuntos = [
  { nombre: 'Prueba Workflow.xlsx', url: '/documentos/archivos/c2646b39.xlsx', pesoKb: '12.5' },
  { nombre: 'Boleta.pdf', url: '/documentos/archivos/a1b2c3d4.pdf', pesoKb: '80' },
];

describe('adjuntos que llegan desde el portal', () => {
  it('acepta la lista como texto JSON, que es como Retool puede enviarla', async () => {
    const dto = plainToInstance(CrearSolicitudDto, {
      ...solicitudBase,
      documentos: JSON.stringify(adjuntos),
    });

    const errores = await validate(dto, OPCIONES);
    expect(errores).toEqual([]);
    expect(dto.documentos).toHaveLength(2);
    expect(dto.documentos?.[0].nombre).toBe('Prueba Workflow.xlsx');
    expect(dto.documentos?.[1].url).toBe('/documentos/archivos/a1b2c3d4.pdf');
  });

  it('acepta también la lista como arreglo, si el cuerpo llega ya estructurado', async () => {
    const dto = plainToInstance(CrearSolicitudDto, {
      ...solicitudBase,
      documentos: adjuntos,
    });
    const errores = await validate(dto, OPCIONES);
    expect(errores).toEqual([]);
    expect(dto.documentos).toHaveLength(2);
  });

  it('sin adjuntos la solicitud sigue siendo válida', async () => {
    const dto = plainToInstance(CrearSolicitudDto, solicitudBase);
    expect(await validate(dto, OPCIONES)).toEqual([]);
  });

  it('un texto vacío se trata como ningún adjunto', async () => {
    const dto = plainToInstance(CrearSolicitudDto, { ...solicitudBase, documentos: '' });
    expect(await validate(dto, OPCIONES)).toEqual([]);
    expect(dto.documentos).toEqual([]);
  });

  it('rechaza un adjunto sin nombre en vez de guardarlo a medias', async () => {
    const dto = plainToInstance(CrearSolicitudDto, {
      ...solicitudBase,
      documentos: JSON.stringify([{ url: '/documentos/archivos/x.pdf' }]),
    });
    const errores = await validate(dto, OPCIONES);
    expect(errores.length).toBeGreaterThan(0);
  });

  it('rechaza más de cinco adjuntos, igual que el endpoint de subida', async () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({
      nombre: `archivo-${i}.pdf`,
      url: `/documentos/archivos/${i}.pdf`,
    }));
    const dto = plainToInstance(CrearSolicitudDto, {
      ...solicitudBase,
      documentos: JSON.stringify(seis),
    });
    const errores = await validate(dto, OPCIONES);
    expect(errores.length).toBeGreaterThan(0);
  });
});
