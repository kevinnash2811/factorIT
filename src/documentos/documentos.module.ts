import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';

@Module({
  controllers: [DocumentosController],
})
export class DocumentosModule {}
