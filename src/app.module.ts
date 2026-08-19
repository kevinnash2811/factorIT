import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { CatalogosModule } from './catalogos/catalogos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SolicitudesModule,
    CatalogosModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
