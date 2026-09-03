import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PreferenciaUsuarioEntity } from '../database/entities/preferencia-usuario.entity';
import { ConsultarPreferenciaQueryDto, GuardarPreferenciaDto, PreferenciaDto } from './dto/preferencia.dto';

@Injectable()
export class PreferenciasService {
  constructor(
    @InjectRepository(PreferenciaUsuarioEntity)
    private readonly prefRepo: Repository<PreferenciaUsuarioEntity>,
  ) {}

  /**
   * Si el usuario todavía no guardó nada, devuelve una preferencia vacía en
   * vez de 404: para el front "sin preferencia" y "mostrar todas las
   * columnas" son lo mismo, y así no tiene que manejar un caso de error.
   */
  async obtener(query: ConsultarPreferenciaQueryDto): Promise<PreferenciaDto> {
    const fila = await this.prefRepo.findOneBy({
      usuarioEmail: query.usuario,
      pantalla: query.pantalla,
    });

    return {
      pantalla: query.pantalla,
      columnasOcultas: fila?.columnasOcultas ?? [],
    };
  }

  /**
   * Upsert por (usuario, pantalla): guardar dos veces la misma pantalla
   * actualiza la fila existente en vez de acumular historial, que para una
   * preferencia de interfaz no aporta nada.
   */
  async guardar(dto: GuardarPreferenciaDto): Promise<PreferenciaDto> {
    const columnasOcultas = dto.columnasOcultas ?? [];

    const existente = await this.prefRepo.findOneBy({
      usuarioEmail: dto.usuario,
      pantalla: dto.pantalla,
    });

    if (existente) {
      existente.columnasOcultas = columnasOcultas;
      existente.actualizadoEn = new Date();
      await this.prefRepo.save(existente);
    } else {
      await this.prefRepo.save(
        this.prefRepo.create({
          usuarioEmail: dto.usuario,
          pantalla: dto.pantalla,
          columnasOcultas,
          actualizadoEn: new Date(),
        }),
      );
    }

    return { pantalla: dto.pantalla, columnasOcultas };
  }
}
