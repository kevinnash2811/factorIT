import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  // Sirve los archivos subidos por /documentos en /documentos/archivos/<nombre>.
  // Almacenamiento provisional en disco — ver nota en documentos.controller.ts.
  app.useStaticAssets(uploadsDir, { prefix: '/documentos/archivos' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('BFF Workflow de Solicitudes — CLA')
    .setDescription(
      'API para el Portal de Gestión Contable en Retool. Cubre por ahora Bandeja Contable ' +
        'e Ingresar Solicitud; el resto de las pantallas se agrega según avance el port.',
    )
    .setVersion('0.1.0')
    .addTag('Solicitudes')
    .addTag('Catálogos')
    .addTag('Indicadores')
    .addTag('Documentos')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`bff-solicitudes escuchando en http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger disponible en http://localhost:${port}/docs`);
}
bootstrap();
