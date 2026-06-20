/**
 * Contratos de los eventos que viajan por el exchange compartido `eciexpress_events`
 * entre orders-service, products-service y financial-service.
 *
 * Convención de routing keys: `servicio.entidad.accion`.
 * Todos los montos van en CENTAVOS COP (enteros), igual que orders/financial.
 */

// ─── Routing keys que CONSUME products-service ──────────────────────────────
export const CONSUMED_ORDER_EVENTS = {
  /** Se creó un carrito (orden DRAFT) en orders. */
  CART_CREATED: 'order.cart.created',
  /** Cambió el conjunto de líneas del carrito (alta/baja/cantidad). */
  CART_ITEM_CHANGED: 'order.cart.item_changed',
  /** El comprador solicitó una devolución (total o parcial). */
  RETURN_REQUESTED: 'order.return.requested',
  /** Checkout: la orden pasó a pago → se reserva stock de las líneas del carrito. */
  ORDER_CREATED: 'order.order.created',
  /** La orden se confirmó → se consume (descuenta) la reserva. */
  ORDER_CONFIRMED: 'order.order.confirmed',
  /** La orden se canceló → se libera la reserva. */
  ORDER_CANCELLED: 'order.order.cancelled',
} as const;

/** Patrón de binding de la cola de products al exchange compartido. */
export const ORDER_BINDING_PATTERN = 'order.#';

// ─── Routing keys que PUBLICA products-service ──────────────────────────────
export const PUBLISHED_PRODUCT_EVENTS = {
  /** Carrito cotizado con precios autoritativos y promociones aplicadas. */
  CART_PRICED: 'products.cart.priced',
  /** Devolución cotizada: monto a reembolsar calculado desde la proyección. */
  RETURN_PRICED: 'products.return.priced',
} as const;

// ─── Payloads consumidos (campos que usamos del envelope de orders) ─────────
export interface CartCreatedPayload {
  cartId: string;
  buyerId: string;
  storeId: string;
  currency?: string;
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartItemChangedPayload {
  cartId: string;
  storeId: string;
  currency?: string;
  items: CartItemInput[];
}

export interface ReturnRequestedPayload {
  /** El orderId de orders coincide con el cartId de la proyección. */
  orderId: string;
  storeId: string;
  full: boolean;
  items?: CartItemInput[];
}

// ─── Payloads publicados ────────────────────────────────────────────────────
export interface PricedCartLine {
  productId: string;
  name: string;
  imageUrl?: string;
  /** Precio de lista unitario (sin promoción), en centavos COP. */
  listUnitPrice: number;
  /** Precio unitario efectivo (con promoción aplicada), en centavos COP. */
  unitPrice: number;
  quantity: number;
  /** unitPrice * quantity, en centavos COP. */
  totalAmount: number;
  appliedPromotionId?: string;
}

export interface CartPricedPayload {
  cartId: string;
  storeId: string;
  currency: string;
  lines: PricedCartLine[];
  subtotalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

export interface ReturnPricedLine {
  productId: string;
  quantity: number;
  /** Monto a reembolsar por esta línea, en centavos COP. */
  amount: number;
}

export interface ReturnPricedPayload {
  orderId: string;
  storeId: string;
  full: boolean;
  refundAmount: number;
  lines: ReturnPricedLine[];
}
