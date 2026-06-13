import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryRepository } from './repositories/category.repository';
import { CATEGORY_REPOSITORY } from './repositories/category.repository.interface';
import { CategoryService } from './services/category.service';
import { CATEGORY_SERVICE } from './services/category.service.interface';
import { CategoryController } from './controllers/category.controller';
import { RabbitMQModule } from '../../messaging/rabbitmq.module';

/**
 * Módulo autocontenido de la feature "Categories".
 * Encapsula todo lo que necesita: entidad, repositorio, servicio y controlador.
 * Se importa una sola vez en AppModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Category]), RabbitMQModule],
  controllers: [CategoryController],
  providers: [
    // Repositorio: ligamos la interfaz a la implementación concreta
    {
      provide: CATEGORY_REPOSITORY,
      useClass: CategoryRepository,
    },
    // Servicio: ligamos la interfaz a la implementación concreta
    {
      provide: CATEGORY_SERVICE,
      useClass: CategoryService,
    },
  ],
  exports: [CATEGORY_SERVICE],
})
export class CategoriesModule {}
