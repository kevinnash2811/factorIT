import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAXIMO_ARCHIVOS } from './drive-archivos.util';

export class ArchivoDriveDto {
  @ApiProperty({ example: '1a2B3c4D5e6F7g8H9i0J', description: 'Id del archivo en Drive.' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  id: string;

  @ApiProperty({ example: 'Factura 8874.pdf' })
  @IsString()
  @MaxLength(255)
  nombre: string;

  @ApiProperty({
    example: 'application/pdf',
    description:
      'Tipo que informa Drive. Los que empiezan con application/vnd.google-apps son ' +
      'documentos nativos y se convierten antes de guardarlos.',
  })
  @IsString()
  @MaxLength(120)
  mimeType: string;
}

export class CopiarDesdeDriveDto {
  @ApiProperty({
    description:
      'Token de acceso que Google entregó al usuario en la ventana del selector. ' +
      'Se usa una sola vez para descargar y no se guarda en ninguna parte.',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;

  @ApiProperty({ type: [ArchivoDriveDto] })
  @ValidateNested({ each: true })
  @Type(() => ArchivoDriveDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_ARCHIVOS)
  archivos: ArchivoDriveDto[];
}

export class DocumentoDriveDto {
  @ApiProperty({ example: 'Factura 8874.pdf' })
  nombre: string;

  @ApiProperty({ example: '/documentos/archivos/9f2a….pdf' })
  url: string;

  @ApiProperty({ example: '245.8' })
  pesoKb: string;

  @ApiProperty({ example: 'drive' })
  origen: string;

  @ApiProperty({
    example: false,
    description: 'true si era un documento nativo de Google y Drive lo convirtió.',
  })
  convertido: boolean;
}

export class ArchivoRechazadoDto {
  @ApiProperty({ example: 'Presupuesto.gform' })
  nombre: string;

  @ApiProperty({ example: 'Es un tipo de documento de Google que no se puede adjuntar.' })
  motivo: string;
}

export class ResultadoDriveDto {
  @ApiProperty({ type: [DocumentoDriveDto] })
  items: DocumentoDriveDto[];

  @ApiProperty({
    type: [ArchivoRechazadoDto],
    description: 'Los que no se pudieron traer. La pantalla los muestra para que el usuario reaccione.',
  })
  rechazados: ArchivoRechazadoDto[];
}
