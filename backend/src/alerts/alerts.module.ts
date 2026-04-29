import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [RulesEngineModule],
  controllers: [AlertsController],
  providers: [AlertsService, PrismaService],
  exports: [AlertsService],
})
export class AlertsModule {}
