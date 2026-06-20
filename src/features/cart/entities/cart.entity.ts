import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartLine } from './cart-line.entity';
import { bigintTransformer } from './numeric.transformer';

/**
 * Proyección del carrito que products-service mantiene como AUTORIDAD DE PRECIOS.
 *
 * El carrito "de verdad" vive en orders-service (una orden en estado DRAFT); aquí
 * solo guardamos una copia con los precios autoritativos y promociones aplicadas,
 * para (a) cotizar el carrito en cada cambio y (b) calcular devoluciones.
 *
 * `id` NO se genera: es el mismo `cartId` (= orderId) que envía orders-service, de
 * modo que ambos servicios quedan sincronizados por una sola clave.
 *
 * Todos los montos están en CENTAVOS COP (enteros).
 */
@Entity('carts')
@Index('IDX_carts_store', ['storeId'])
export class Cart {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'store_id', type: 'uuid' })
  storeId: string;

  @Column({ type: 'varchar', length: 8, default: 'COP' })
  currency: string;

  @Column({ name: 'subtotal_amount', type: 'bigint', default: 0, transformer: bigintTransformer })
  subtotalAmount: number;

  @Column({ name: 'discount_amount', type: 'bigint', default: 0, transformer: bigintTransformer })
  discountAmount: number;

  @Column({ name: 'final_amount', type: 'bigint', default: 0, transformer: bigintTransformer })
  finalAmount: number;

  @OneToMany(() => CartLine, (line) => line.cart, { cascade: true, eager: true })
  lines: CartLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
