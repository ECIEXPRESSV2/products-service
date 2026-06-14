import { Test, TestingModule } from '@nestjs/testing';
import { CategoryPublisher, RABBITMQ_CLIENT } from './category.publisher';
import { ClientProxy } from '@nestjs/microservices';
import { CATEGORY_EVENTS } from '../events/category.events';
import { of, throwError } from 'rxjs';

const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const CAT_ID = 'a3bb189e-8bf9-3888-9912-ace4e6543002';

describe('CategoryPublisher', () => {
  let publisher: CategoryPublisher;
  let client: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    const clientMock = {
      emit: jest.fn().mockReturnValue(of(null)),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoryPublisher, { provide: RABBITMQ_CLIENT, useValue: clientMock }],
    }).compile();

    publisher = module.get(CategoryPublisher);
    client = clientMock;
  });

  describe('categoryCreated', () => {
    it('emits CREATED event with correct payload', () => {
      const payload = {
        id: CAT_ID,
        storeId: STORE_ID,
        name: 'Bebidas',
        slug: 'bebidas',
        parentId: null,
      };

      publisher.categoryCreated(payload);

      expect(client.emit).toHaveBeenCalledWith(CATEGORY_EVENTS.CREATED, payload);
    });
  });

  describe('categoryUpdated', () => {
    it('emits UPDATED event with correct payload', () => {
      const payload = { id: CAT_ID, storeId: STORE_ID, name: 'Bebidas Premium' };

      publisher.categoryUpdated(payload);

      expect(client.emit).toHaveBeenCalledWith(CATEGORY_EVENTS.UPDATED, payload);
    });
  });

  describe('categoryDeleted', () => {
    it('emits DELETED event with correct payload', () => {
      const payload = { id: CAT_ID, storeId: STORE_ID };

      publisher.categoryDeleted(payload);

      expect(client.emit).toHaveBeenCalledWith(CATEGORY_EVENTS.DELETED, payload);
    });
  });

  describe('emit (error handling)', () => {
    it('does not throw when client.emit errors', () => {
      client.emit.mockReturnValue(throwError(() => new Error('RabbitMQ down')));

      expect(() =>
        publisher.categoryCreated({
          id: CAT_ID,
          storeId: STORE_ID,
          name: 'X',
          slug: 'x',
          parentId: null,
        }),
      ).not.toThrow();
    });
  });
});
