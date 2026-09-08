import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerfilesPermisoService } from './perfiles-permiso.service';
import { GuardarPerfilPermisoDto, PerfilPermisoDto } from './dto/perfil-permiso.dto';

@ApiTags('Perfiles de Permiso')
@Controller('perfiles-permiso')
export class PerfilesPermisoController {
  constructor(private readonly service: PerfilesPermisoService) {}

  @Get('secciones')
  @ApiOperation({
    summary: 'Catálogo de secciones del portal',
    description:
      'Nivel 1 del menú. Es la fuente de verdad de qué se puede permitir; el front lo usa ' +
      'para pintar los interruptores y el backend para validar lo que le mandan.',
  })
  secciones() {
    return this.service.secciones();
  }

  @Get('plantilla')
  @ApiOperation({
    summary: 'Valores por defecto de un perfil nuevo',
    description:
      'Todos los permisos en su valor más restrictivo. El front lo usa para abrir ' +
      'el formulario de "Nuevo perfil" sin inventar valores.',
  })
  plantilla() {
    return this.service.plantillaVacia();
  }

  @Get()
  @ApiOperation({
    summary: 'Perfiles existentes',
    description: 'Incluye las secciones ya resueltas con etiqueta e icono, y cuántos colaboradores tiene cada uno.',
  })
  @ApiOkResponse({ type: [PerfilPermisoDto] })
  listar() {
    return this.service.listar();
  }

  @Put()
  @ApiOperation({
    summary: 'Crear o actualizar un perfil',
    description: 'Sin perfilId crea uno nuevo; con perfilId actualiza el existente.',
  })
  @ApiOkResponse({ type: PerfilPermisoDto })
  guardar(@Body() dto: GuardarPerfilPermisoDto) {
    return this.service.guardar(dto);
  }

  @Delete(':perfilId')
  @ApiOperation({
    summary: 'Eliminar un perfil',
    description:
      'Las personas que lo tenían asignado quedan sin perfil, no se borran. La respuesta ' +
      'indica a cuántas afectó.',
  })
  eliminar(@Param('perfilId', ParseIntPipe) perfilId: number) {
    return this.service.eliminar(perfilId);
  }
}
