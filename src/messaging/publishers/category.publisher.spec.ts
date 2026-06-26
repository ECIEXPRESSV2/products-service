import { Test, TestingModule } from '@nestjs/testing';
import { CategoryPublisher } from './category.publisher';
import { CATEGORY_EVENTS } from '../events/category.events';
import { SharedEventPublisher } from '../shared-bus/shared-event-publisher.service';

const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const CAT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

describe('CategoryPublisher', () => {
  let publisher: CategoryPublisher;
  let bus: jest.Mocked<SharedEventPublisher>;

  beforeEach(async () => {
    const busMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SharedEventPublisher>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryPublisher, { provide: SharedEventPublisher, useValue: busMock }],
    }).compile();

    publisher = module.get(CategoryPublisher);
    bus = busMock;
  });

  describe('categoryCreated', () => {
    it('publishes CREATED event to the shared bus with correct payload', () => {
      const payload = {
        id: CAT_ID,
        storeId: STORE_ID,
        name: 'Bebidas',
        slug: 'bebidas',
        parentId: null,
      };

      publisher.categoryCreated(payload);

      expect(bus.publish).toHaveBeenCalledWith(CATEGORY_EVENTS.CREATED, payload);
    });
  });

  describe('categoryUpdated', () => {
    it('publishes UPDATED event to the shared bus with correct payload', () => {
      const payload = { id: CAT_ID, storeId: STORE_ID, name: 'Bebidas Premium' };

      publisher.categoryUpdated(payload);

      expect(bus.publish).toHaveBeenCalledWith(CATEGORY_EVENTS.UPDATED, payload);
    });
  });

  describe('categoryDeleted', () => {
    it('publishes DELETED event to the shared bus with correct payload', () => {
      const payload = { id: CAT_ID, storeId: STORE_ID };

      publisher.categoryDeleted(payload);

      expect(bus.publish).toHaveBeenCalledWith(CATEGORY_EVENTS.DELETED, payload);
    });
  });
});
