// Contratos de eventos publicados por el Order Service que este microservicio consume.
// Mantener sincronizado con los payloads publicados por order-service.

export const ORDER_EVENTS = {
  PLACED: 'order.placed',
  CONFIRMED: 'order.confirmed',
  CANCELLED: 'order.cancelled',
} as const;

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface OrderPlacedPayload {
  orderId: string;
  storeId: string;
  items: OrderItem[];
}

export interface OrderConfirmedPayload {
  orderId: string;
  storeId: string;
  items: OrderItem[];
}

export interface OrderCancelledPayload {
  orderId: string;
  storeId: string;
  items: OrderItem[];
}
