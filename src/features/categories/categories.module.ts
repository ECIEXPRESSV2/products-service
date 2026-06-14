import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryRepository } from './repositories/category.repository';
import { CATEGORY_REPOSITORY } from './repositories/category.repository.interface';
import { CategoryService } from './services/category.service';
import { CATEGORY_SERVICE } from './services/category.service.interface';
import { CategoryController } from './controllers/category.controller';
import { RabbitMQModule } from '../../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), RabbitMQModule, AuditModule],
  controllers: [CategoryController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepository },
    { provide: CATEGORY_SERVICE, useClass: CategoryService },
  ],
  exports: [CATEGORY_SERVICE],
})
export class CategoriesModule {}
