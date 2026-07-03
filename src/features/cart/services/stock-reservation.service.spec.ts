import { StockReservationService } from './stock-reservation.service';
import { PUBLISHED_PRODUCT_EVENTS } from '../../../messaging/shared-bus/contracts';

interface Line { productId: string; quantity: number; stockReserved: boolean }
interface Cart { id: string; storeId: string; lines: Line[] }

class FakeCarts {
  carts = new Map<string, Cart>();
  seed(cart: Cart) { this.carts.set(cart.id, cart); }
  async findById(id: string) { return this.carts.get(id) ?? null; }
  async markLineReserved(cartId: string, productId: string, reserved: boolean) {
    const line = this.carts.get(cartId)?.lines.find((l) => l.productId === productId);
    if (line) line.stockReserved = reserved;
  }
}

class FakeProducts {
  stock: number;
  reserveCalls = 0;
  restoreCalls = 0;
  releaseCalls = 0;
  constructor(stock: number) { this.stock = stock; }
  async reserveStock(_p: string, qty: number) {
    this.reserveCalls += 1;
    if (this.stock < qty) throw new Error(`Stock disponible insuficiente. Disponible: ${this.stock}, requerido: ${qty}`);
    this.stock -= qty;
  }
  async restoreStock(_p: string, qty: number) { this.restoreCalls += 1; this.stock += qty; }
  async releaseStock() { this.releaseCalls += 1; }
  async findById(id: string) { return { id, stock: this.stock, reservedStock: 0, storeId: 'store-1' }; }
}

class FakePublisher {
  events: string[] = [];
  async publish(routingKey: string) { this.events.push(routingKey); }
}

const build = (cart: Cart, stock: number) => {
  const carts = new FakeCarts();
  carts.seed(cart);
  const products = new FakeProducts(stock);
  const publisher = new FakePublisher();
  const service = new StockReservationService(carts as any, products as any, publisher as any);
  return { service, carts, products, publisher };
};

describe('StockReservationService — idempotencia (bus at-least-once)', () => {
  it('releaseForOrder: un order.cancelled DUPLICADO no restituye el stock dos veces', async () => {
    const cart: Cart = { id: 'o1', storeId: 'store-1', lines: [{ productId: 'p1', quantity: 3, stockReserved: true }] };
    const { service, products, carts } = build(cart, 0); // vendido: stock físico 0

    await service.releaseForOrder('o1', true); // primera cancelación (wasSold)
    expect(products.restoreCalls).toBe(1);
    expect(products.stock).toBe(3); // 0 -> 3 (correcto)
    expect(carts.carts.get('o1')!.lines[0].stockReserved).toBe(false); // línea liberada

    await service.releaseForOrder('o1', true); // entrega DUPLICADA de order.cancelled
    expect(products.restoreCalls).toBe(1); // NO restituye otra vez
    expect(products.stock).toBe(3); // sigue 3, no 6 (antes se "duplicaba")
  });

  it('reserveForOrder: un order.created DUPLICADO no re-reserva ni emite reservation_rejected espurio', async () => {
    // La línea ya quedó reservada por la primera entrega.
    const cart: Cart = { id: 'o2', storeId: 'store-1', lines: [{ productId: 'p1', quantity: 3, stockReserved: true }] };
    const { service, products, publisher } = build(cart, 0); // stock ya agotado

    await service.reserveForOrder('o2'); // segunda entrega (duplicada)
    expect(products.reserveCalls).toBe(0); // saltó la línea ya reservada
    expect(publisher.events).not.toContain(PUBLISHED_PRODUCT_EVENTS.RESERVATION_REJECTED);
    expect(publisher.events).toContain(PUBLISHED_PRODUCT_EVENTS.RESERVATION_CONFIRMED);
  });

  it('reserveForOrder: una línea NO reservada sí se reserva (camino normal)', async () => {
    const cart: Cart = { id: 'o3', storeId: 'store-1', lines: [{ productId: 'p1', quantity: 2, stockReserved: false }] };
    const { service, products, publisher, carts } = build(cart, 5);

    await service.reserveForOrder('o3');
    expect(products.reserveCalls).toBe(1);
    expect(products.stock).toBe(3); // 5 - 2
    expect(carts.carts.get('o3')!.lines[0].stockReserved).toBe(true);
    expect(publisher.events).toContain(PUBLISHED_PRODUCT_EVENTS.RESERVATION_CONFIRMED);
  });
});
