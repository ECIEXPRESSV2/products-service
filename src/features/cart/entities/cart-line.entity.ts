import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { bigintTransformer } from './numeric.transformer';

/**
 * Línea del carrito proyectado. Guarda el precio AUTORITATIVO unitario (con y sin
 * promoción) en centavos COP, para poder cotizar devoluciones parciales sin volver
 * a consultar el catálogo.
 */
@Entity('cart_lines')
@Index('IDX_cart_lines_cart', ['cartId'])
@Index('IDX_cart_lines_cart_product', ['cartId', 'productId'], { unique: true })
export class CartLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cart_id', type: 'uuid' })
  cartId: string;

  @ManyToOne(() => Cart, (cart) => cart.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'list_unit_price', type: 'bigint', transformer: bigintTransformer })
  listUnitPrice: number;

  @Column({ name: 'unit_price', type: 'bigint', transformer: bigintTransformer })
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'total_amount', type: 'bigint', transformer: bigintTransformer })
  totalAmount: number;

  @Column({ name: 'applied_promotion_id', type: 'uuid', nullable: true })
  appliedPromotionId: string | null;

  /**
   * true solo si `reserveStock` se aplicó EXITOSAMENTE para esta línea específica.
   * Necesario porque `reservedStock` en `products` es un contador global por
   * producto, no por orden: sin este flag, liberar/restituir stock al cancelar una
   * orden cuya reserva falló (o nunca llegó a intentarse) terminaría restando del
   * contador global la reserva de OTRA orden que sí tuvo éxito.
   */
  @Column({ name: 'stock_reserved', type: 'boolean', default: false })
  stockReserved: boolean;
}
