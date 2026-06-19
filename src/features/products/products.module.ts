import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductRepository } from './repositories/product.repository';
import { PRODUCT_REPOSITORY } from './repositories/product.repository.interface';
import { ProductService } from './services/product.service';
import { PRODUCT_SERVICE } from './services/product.service.interface';
import { ProductController } from './controllers/product.controller';
import { RabbitMQModule } from '../../messaging/rabbitmq.module';
import { AuditModule } from '../audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';
import { CategoryRepository } from '../categories/repositories/category.repository';
import { CATEGORY_REPOSITORY } from '../categories/repositories/category.repository.interface';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Category]),
    RabbitMQModule,
    AuditModule,
    CategoriesModule,
  ],
  controllers: [ProductController],
  providers: [
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepository },
    { provide: PRODUCT_SERVICE, useClass: ProductService },
    // CategoryRepository se necesita en ProductService para validar pertenencia a la tienda.
    // Se registra localmente en lugar de depender del export de CategoriesModule (que exporta solo el servicio).
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepository },
  ],
  exports: [PRODUCT_SERVICE],
})
export class ProductsModule {}
