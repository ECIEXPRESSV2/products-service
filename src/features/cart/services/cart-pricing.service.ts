import { Inject, Injectable, Logger } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from '../../products/repositories/product.repository.interface';
import type { IProductRepository } from '../../products/repositories/product.repository.interface';
import { PROMOTION_SERVICE } from '../../promotions/services/promotion.service.interface';
import type { IPromotionService } from '../../promotions/services/promotion.service.interface';
import { CART_REPOSITORY } from '../repositories/cart.repository';
import type { ICartRepository } from '../repositories/cart.repository';
import { SharedEventPublisher } from '../../../messaging/shared-bus/shared-event-publisher.service';
import {
  CartItemInput,
  CartPricedPayload,
  PricedCartLine,
  PUBLISHED_PRODUCT_EVENTS,
} from '../../../messaging/shared-bus/contracts';

/** Pesos (decimal del catálogo) → centavos COP enteros. */
const toCents = (pesos: number): number => Math.round(pesos * 100);

/**
 * Autoridad de precios del carrito. Ante cada cambio en el carrito (orden DRAFT de
 * orders-service), resuelve cada producto del catálogo, aplica la mejor promoción
 * vigente, persiste la proyección y publica `products.cart.priced` con los precios
 * autoritativos en centavos COP.
 */
@Injectable()
export class CartPricingService {
  private readonly logger = new Logger(CartPricingService.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: IProductRepository,
    @Inject(PROMOTION_SERVICE) private readonly promotions: IPromotionService,
    @Inject(CART_REPOSITORY) private readonly carts: ICartRepository,
    private readonly publisher: SharedEventPublisher,
  ) {}

  /** Crea (idempotente) la proyección vacía del carrito y la cotiza (vacía). */
  async createCart(cartId: string, storeId: string, currency = 'COP'): Promise<void> {
    await this.carts.ensure(cartId, storeId, currency);
    await this.publishPriced({ cartId, storeId, currency, lines: [], subtotalAmount: 0, discountAmount: 0, finalAmount: 0 });
    this.logger.log(`Carrito creado y cotizado (vacío): ${cartId}`);
  }

  /** Recalcula el carrito completo a partir del conjunto de líneas recibido. */
  async priceCart(
    cartId: string,
    storeId: string,
    items: CartItemInput[],
    currency = 'COP',
  ): Promise<CartPricedPayload> {
    const lines: PricedCartLine[] = [];
    let subtotalAmount = 0;
    let finalAmount = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) continue;

      const product = await this.products.findById(item.productId);
      if (!product || !product.isActive || product.storeId !== storeId) {
        this.logger.warn(
          `Producto ${item.productId} no disponible en tienda ${storeId}; omitido del carrito ${cartId}`,
        );
        continue;
      }

      const basePesos = parseFloat(product.price);
      const effective = await this.promotions.calculateEffectivePrice(
        storeId,
        product.id,
        product.categoryId,
        basePesos,
      );

      const listUnitPrice = toCents(basePesos);
      const unitPrice = toCents(effective.effectivePrice);
      const totalAmount = unitPrice * item.quantity;

      lines.push({
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl ?? undefined,
        listUnitPrice,
        unitPrice,
        quantity: item.quantity,
        totalAmount,
        appliedPromotionId: effective.appliedPromotion?.id,
      });

      subtotalAmount += listUnitPrice * item.quantity;
      finalAmount += totalAmount;
    }

    const discountAmount = subtotalAmount - finalAmount;

    await this.carts.replaceLines(
      cartId,
      storeId,
      currency,
      lines.map((line) => ({
        productId: line.productId,
        name: line.name,
        imageUrl: line.imageUrl ?? null,
        listUnitPrice: line.listUnitPrice,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        totalAmount: line.totalAmount,
        appliedPromotionId: line.appliedPromotionId ?? null,
      })),
      { subtotalAmount, discountAmount, finalAmount },
    );

    const payload: CartPricedPayload = {
      cartId,
      storeId,
      currency,
      lines,
      subtotalAmount,
      discountAmount,
      finalAmount,
    };
    await this.publishPriced(payload);
    this.logger.log(
      `Carrito ${cartId} cotizado: ${lines.length} líneas, total ${finalAmount} centavos`,
    );
    return payload;
  }

  private async publishPriced(payload: CartPricedPayload): Promise<void> {
    await this.publisher.publish(PUBLISHED_PRODUCT_EVENTS.CART_PRICED, {
      ...payload,
    } as unknown as Record<string, unknown>);
  }
}
