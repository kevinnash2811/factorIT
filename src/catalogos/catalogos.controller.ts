import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';
import { CatalogosDto } from './dto/catalogos.dto';

@ApiTags('Catálogos')
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly service: CatalogosService) {}

  @Get()
  @ApiOperation({ summary: 'Rutas, CECOs y medios de pago para el formulario de Ingresar Solicitud' })
  @ApiOkResponse({ type: CatalogosDto })
  obtener() {
    return this.service.obtener();
  }
}
