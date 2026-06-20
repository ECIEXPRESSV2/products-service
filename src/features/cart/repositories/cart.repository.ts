import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cart } from '../entities/cart.entity';
import { CartLine } from '../entities/cart-line.entity';

export const CART_REPOSITORY = Symbol('ICartRepository');

export interface ICartRepository {
  findById(cartId: string): Promise<Cart | null>;
  /** Crea el carrito vacío si no existe (idempotente). */
  ensure(cartId: string, storeId: string, currency: string): Promise<Cart>;
  /**
   * Reemplaza atómicamente las líneas del carrito y actualiza los totales.
   * `lines` ya viene con los precios autoritativos calculados.
   */
  replaceLines(
    cartId: string,
    storeId: string,
    currency: string,
    lines: Array<Partial<CartLine>>,
    totals: { subtotalAmount: number; discountAmount: number; finalAmount: number },
  ): Promise<Cart>;
}

@Injectable()
export class CartRepository implements ICartRepository {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    private readonly dataSource: DataSource,
  ) {}

  findById(cartId: string): Promise<Cart | null> {
    return this.carts.findOne({ where: { id: cartId } });
  }

  async ensure(cartId: string, storeId: string, currency: string): Promise<Cart> {
    const existing = await this.carts.findOne({ where: { id: cartId } });
    if (existing) return existing;
    const cart = this.carts.create({
      id: cartId,
      storeId,
      currency,
      subtotalAmount: 0,
      discountAmount: 0,
      finalAmount: 0,
      lines: [],
    });
    return this.carts.save(cart);
  }

  async replaceLines(
    cartId: string,
    storeId: string,
    currency: string,
    lines: Array<Partial<CartLine>>,
    totals: { subtotalAmount: number; discountAmount: number; finalAmount: number },
  ): Promise<Cart> {
    return this.dataSource.transaction(async (manager) => {
      const cartRepo = manager.getRepository(Cart);
      const lineRepo = manager.getRepository(CartLine);

      await cartRepo.save(
        cartRepo.create({
          id: cartId,
          storeId,
          currency,
          subtotalAmount: totals.subtotalAmount,
          discountAmount: totals.discountAmount,
          finalAmount: totals.finalAmount,
        }),
      );

      await lineRepo.delete({ cartId });
      if (lines.length > 0) {
        await lineRepo.insert(lines.map((line) => ({ ...line, cartId })));
      }

      const saved = await cartRepo.findOne({ where: { id: cartId } });
      return saved!;
    });
  }
}
