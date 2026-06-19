import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from './entities/promotion.entity';
import { PromotionRepository } from './repositories/promotion.repository';
import { PROMOTION_REPOSITORY } from './repositories/promotion.repository.interface';
import { PromotionService } from './services/promotion.service';
import { PROMOTION_SERVICE } from './services/promotion.service.interface';
import { PromotionController } from './controllers/promotion.controller';
import { RabbitMQModule } from '../../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion]), RabbitMQModule, AuditModule],
  controllers: [PromotionController],
  providers: [
    { provide: PROMOTION_REPOSITORY, useClass: PromotionRepository },
    { provide: PROMOTION_SERVICE, useClass: PromotionService },
  ],
  exports: [PROMOTION_SERVICE],
})
export class PromotionsModule {}
