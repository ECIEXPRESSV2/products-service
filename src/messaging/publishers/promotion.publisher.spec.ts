import { Test, TestingModule } from '@nestjs/testing';
import { PromotionPublisher } from './promotion.publisher';
import { PROMOTION_EVENTS } from '../events/promotion.events';
import { SharedEventPublisher } from '../shared-bus/shared-event-publisher.service';
import { PromotionScope, PromotionType } from '../../features/promotions/entities/promotion.entity';

describe('PromotionPublisher', () => {
  let publisher: PromotionPublisher;
  let busPublish: jest.Mock;

  beforeEach(async () => {
    busPublish = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionPublisher,
        { provide: SharedEventPublisher, useValue: { publish: busPublish } },
      ],
    }).compile();

    publisher = module.get(PromotionPublisher);
  });

  it('publishes product.promotion.created with correct payload', () => {
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

    expect(busPublish).toHaveBeenCalledWith(PROMOTION_EVENTS.CREATED, payload);
  });

  it('publishes product.promotion.updated with correct payload', () => {
    const payload = { id: 'promo-1', storeId: 'store-1', isActive: false };

    publisher.promotionUpdated(payload);

    expect(busPublish).toHaveBeenCalledWith(PROMOTION_EVENTS.UPDATED, payload);
  });

  it('publishes product.promotion.deleted with correct payload', () => {
    const payload = { id: 'promo-1', storeId: 'store-1' };

    publisher.promotionDeleted(payload);

    expect(busPublish).toHaveBeenCalledWith(PROMOTION_EVENTS.DELETED, payload);
  });
});
