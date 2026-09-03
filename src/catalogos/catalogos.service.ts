import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { CentroCostoEntity } from '../database/entities/centro-costo.entity';
import { SOCIEDADES, CLASES_DOCUMENTO } from '../common/rutas-catalogo.util';
import { CatalogosDto } from './dto/catalogos.dto';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(RutaPagoEntity) private readonly rutaRepo: Repository<RutaPagoEntity>,
    @InjectRepository(CentroCostoEntity) private readonly cecoRepo: Repository<CentroCostoEntity>,
  ) {}

  async obtener(): Promise<CatalogosDto> {
    const [rutas, cecos] = await Promise.all([
      this.rutaRepo.find({ where: { activo: true }, order: { rutaId: 'ASC' } }),
      this.cecoRepo.find({ order: { cecoId: 'ASC' } }),
    ]);

    return {
      rutas: rutas.map((r) => ({
        id: r.rutaId,
        nombre: r.nombreRuta,
        sociedad: r.sociedadSap,
        claseDoc: r.claseDocumentoSap,
        confidencial: r.confidencial,
      })),
      cecos: cecos.map((c) => ({ id: c.cecoId, nombreGerencia: c.nombreGerencia })),
      sociedades: Object.entries(SOCIEDADES).map(([codigo, s]) => ({ codigo, etiqueta: `${s.etiqueta} (${s.nombre})` })),
      clasesDocumento: Object.entries(CLASES_DOCUMENTO).map(([codigo, descripcion]) => ({ codigo, etiqueta: `${codigo} (${descripcion})` })),
      mediosPago: [
        { codigo: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
        { codigo: 'CHEQUE', etiqueta: 'Cheque' },
      ],
      // Igual que mediosPago: son opciones fijas de configuración, no filas de una
      // tabla que alguien mantenga — por eso van hardcodeadas acá, no en una tabla nueva.
      bancos: [
        { codigo: 'BANCO DE CHILE', etiqueta: 'BANCO DE CHILE' },
        { codigo: 'BANCO ESTADO', etiqueta: 'BANCO ESTADO' },
        { codigo: 'BANCO SANTANDER', etiqueta: 'BANCO SANTANDER' },
        { codigo: 'BANCO BCI', etiqueta: 'BANCO BCI' },
        { codigo: 'BANCO ITAÚ', etiqueta: 'BANCO ITAÚ' },
        { codigo: 'SCOTIABANK', etiqueta: 'SCOTIABANK' },
      ],
      tiposCuenta: [
        { codigo: 'Corriente', etiqueta: 'Cuenta Corriente' },
        { codigo: 'Vista', etiqueta: 'Cuenta Vista / RUT' },
        { codigo: 'Ahorro', etiqueta: 'Cuenta de Ahorro' },
      ],
    };
  }
}
