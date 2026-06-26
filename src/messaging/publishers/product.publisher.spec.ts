import { Test, TestingModule } from '@nestjs/testing';
import { ProductPublisher } from './product.publisher';
import { PRODUCT_EVENTS } from '../events/product.events';
import { SharedEventPublisher } from '../shared-bus/shared-event-publisher.service';

describe('ProductPublisher', () => {
  let publisher: ProductPublisher;
  let busPublish: jest.Mock;

  beforeEach(async () => {
    busPublish = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductPublisher,
        { provide: SharedEventPublisher, useValue: { publish: busPublish } },
      ],
    }).compile();

    publisher = module.get(ProductPublisher);
  });

  it('publishes product.item.created with correct payload', () => {
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

    expect(busPublish).toHaveBeenCalledWith(PRODUCT_EVENTS.CREATED, payload);
  });

  it('publishes product.item.updated with correct payload', () => {
    const payload = { id: 'prod-1', storeId: 'store-1', isActive: false };

    publisher.productUpdated(payload);

    expect(busPublish).toHaveBeenCalledWith(PRODUCT_EVENTS.UPDATED, payload);
  });

  it('publishes product.item.deleted with correct payload', () => {
    const payload = { id: 'prod-1', storeId: 'store-1' };

    publisher.productDeleted(payload);

    expect(busPublish).toHaveBeenCalledWith(PRODUCT_EVENTS.DELETED, payload);
  });
});
