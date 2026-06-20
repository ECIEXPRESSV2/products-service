import { Test, TestingModule } from '@nestjs/testing';
import { ProductPublisher } from './product.publisher';
import { RABBITMQ_CLIENT } from './category.publisher';
import { PRODUCT_EVENTS } from '../events/product.events';

describe('ProductPublisher', () => {
  let publisher: ProductPublisher;
  let clientEmit: jest.Mock;

  beforeEach(async () => {
    clientEmit = jest.fn().mockReturnValue({ subscribe: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductPublisher,
        { provide: RABBITMQ_CLIENT, useValue: { emit: clientEmit } },
      ],
    }).compile();

    publisher = module.get(ProductPublisher);
  });

  it('emits product.item.created with correct payload', () => {
    const payload = {
      id: 'prod-1',
      storeId: 'store-1',
      categoryId: 'cat-1',
      name: 'Café',
      slug: 'cafe',
      price: '3500.00',
      sku: null,
      stock: 10,
    };

    publisher.productCreated(payload);

    expect(clientEmit).toHaveBeenCalledWith(PRODUCT_EVENTS.CREATED, payload);
  });

  it('emits product.item.updated with correct payload', () => {
    const payload = { id: 'prod-1', storeId: 'store-1', isActive: false };

    publisher.productUpdated(payload);

    expect(clientEmit).toHaveBeenCalledWith(PRODUCT_EVENTS.UPDATED, payload);
  });

  it('emits product.item.deleted with correct payload', () => {
    const payload = { id: 'prod-1', storeId: 'store-1' };

    publisher.productDeleted(payload);

    expect(clientEmit).toHaveBeenCalledWith(PRODUCT_EVENTS.DELETED, payload);
  });
});
