import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PromotionPublisher } from './promotion.publisher';
import { RABBITMQ_CLIENT } from './category.publisher';
import { PROMOTION_EVENTS } from '../events/promotion.events';
import { PromotionScope, PromotionType } from '../../features/promotions/entities/promotion.entity';

describe('PromotionPublisher', () => {
  let publisher: PromotionPublisher;
  let clientEmit: jest.Mock;

  beforeEach(async () => {
    clientEmit = jest.fn().mockReturnValue({ subscribe: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionPublisher,
        { provide: RABBITMQ_CLIENT, useValue: { emit: clientEmit } },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: { log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    publisher = module.get(PromotionPublisher);
  });

  it('emits product.promotion.created with correct payload', () => {
    const payload = {
      id: 'promo-1',
      storeId: 'store-1',
      name: '15% en Café',
      type: PromotionType.PERCENTAGE,
      value: '15.00',
      scope: PromotionScope.PRODUCT,
      targetId: 'product-1',
      startsAt: new Date('2024-01-01'),
      endsAt: null,
    };

    publisher.promotionCreated(payload);

    expect(clientEmit).toHaveBeenCalledWith(PROMOTION_EVENTS.CREATED, payload);
  });

  it('emits product.promotion.updated with correct payload', () => {
    const payload = { id: 'promo-1', storeId: 'store-1', isActive: false };

    publisher.promotionUpdated(payload);

    expect(clientEmit).toHaveBeenCalledWith(PROMOTION_EVENTS.UPDATED, payload);
  });

  it('emits product.promotion.deleted with correct payload', () => {
    const payload = { id: 'promo-1', storeId: 'store-1' };

    publisher.promotionDeleted(payload);

    expect(clientEmit).toHaveBeenCalledWith(PROMOTION_EVENTS.DELETED, payload);
  });

  it('swallows errors thrown by client.emit without propagating', () => {
    clientEmit.mockImplementation(() => { throw new Error('RabbitMQ unavailable'); });

    expect(() => publisher.promotionDeleted({ id: 'p', storeId: 's' })).not.toThrow();
  });
});
