import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RutaPagoEntity } from '../database/entities/ruta-pago.entity';
import { CentroCostoEntity } from '../database/entities/centro-costo.entity';
import { esRutaConfidencial } from '../common/confidencialidad.util';
import { CatalogosDto } from './dto/catalogos.dto';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(RutaPagoEntity) private readonly rutaRepo: Repository<RutaPagoEntity>,
    @InjectRepository(CentroCostoEntity) private readonly cecoRepo: Repository<CentroCostoEntity>,
  ) {}

  async obtener(): Promise<CatalogosDto> {
    const [rutas, cecos] = await Promise.all([
      this.rutaRepo.find({ order: { rutaId: 'ASC' } }),
      this.cecoRepo.find({ order: { cecoId: 'ASC' } }),
    ]);

    return {
      rutas: rutas.map((r) => ({
        id: r.rutaId,
        nombre: r.nombreRuta,
        sociedad: r.sociedadSap,
        claseDoc: r.claseDocumentoSap,
        confidencial: esRutaConfidencial(r.rutaId),
      })),
      cecos: cecos.map((c) => ({ id: c.cecoId, nombreGerencia: c.nombreGerencia })),
      mediosPago: [
        { codigo: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
        { codigo: 'CHEQUE', etiqueta: 'Cheque' },
      ],
    };
  }
}
