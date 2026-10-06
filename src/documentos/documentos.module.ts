import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { DriveController } from './drive/drive.controller';
import { DriveService } from './drive/drive.service';

@Module({
  controllers: [DocumentosController, DriveController],
  providers: [DriveService],
})
export class DocumentosModule {}
