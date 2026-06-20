import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cart } from './entities/cart.entity';
import { CartLine } from './entities/cart-line.entity';
import { CartRepository, CART_REPOSITORY } from './repositories/cart.repository';
import { CartPricingService } from './services/cart-pricing.service';
import { ReturnsPricingService } from './services/returns-pricing.service';
import { StockReservationService } from './services/stock-reservation.service';
import { OrderEventsConsumer } from './messaging/order-events.consumer';
import { Product } from '../products/entities/product.entity';
import { ProductRepository } from '../products/repositories/product.repository';
import { PRODUCT_REPOSITORY } from '../products/repositories/product.repository.interface';
import { ProductsModule } from '../products/products.module';
import { PromotionsModule } from '../promotions/promotions.module';

/**
 * Proyección del carrito y autoridad de precios sobre el bus compartido.
 *
 * Consume `order.cart.*` / `order.return.requested` de orders-service, aplica
 * promociones (PromotionsModule) sobre los precios del catálogo y publica
 * `products.cart.priced` / `products.return.priced`.
 *
 * Registra PRODUCT_REPOSITORY localmente (solo necesita Repository<Product>) en
 * lugar de depender del export de ProductsModule, que expone únicamente el servicio.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartLine, Product]), PromotionsModule, ProductsModule],
  providers: [
    { provide: CART_REPOSITORY, useClass: CartRepository },
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepository },
    CartPricingService,
    ReturnsPricingService,
    StockReservationService,
    OrderEventsConsumer,
  ],
  exports: [CartPricingService, ReturnsPricingService],
})
export class CartModule {}
