import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { StockConsumer } from './stock.consumer';
import { PRODUCT_SERVICE } from '../services/product.service.interface';
import type { IProductService } from '../services/product.service.interface';

const ORDER_ID = 'order-uuid-001';
const STORE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCT_A = 'product-uuid-aaa';
const PRODUCT_B = 'product-uuid-bbb';

describe('StockConsumer', () => {
  let consumer: StockConsumer;
  let productService: jest.Mocked<IProductService>;

  beforeEach(async () => {
    const serviceMock: jest.Mocked<IProductService> = {
      findAll: jest.fn(),
      findAllPaginated: jest.fn(),
      findByCategory: jest.fn(),
      findByCategoryPaginated: jest.fn(),
      findLowStock: jest.fn(),
      search: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      activate: jest.fn(),
      deactivate: jest.fn(),
      adjustStock: jest.fn(),
      reserveStock: jest.fn(),
      releaseStock: jest.fn(),
      confirmReservation: jest.fn(),
      remove: jest.fn(),
    };

    const loggerMock = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockConsumer],
      providers: [
        { provide: PRODUCT_SERVICE, useValue: serviceMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: loggerMock },
      ],
    }).compile();

    consumer = module.get(StockConsumer);
    productService = serviceMock;
  });

  // ── handleOrderPlaced ────────────────────────────────────────────────────

  describe('handleOrderPlaced', () => {
    it('reserves stock for all items in the order', async () => {
      productService.reserveStock.mockResolvedValue(undefined);

      await consumer.handleOrderPlaced({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      });

      expect(productService.reserveStock).toHaveBeenCalledTimes(2);
      expect(productService.reserveStock).toHaveBeenCalledWith(PRODUCT_A, 2, ORDER_ID);
      expect(productService.reserveStock).toHaveBeenCalledWith(PRODUCT_B, 1, ORDER_ID);
    });

    it('rolls back successful reservations when a later item fails', async () => {
      productService.reserveStock
        .mockResolvedValueOnce(undefined) // PRODUCT_A succeeds
        .mockRejectedValueOnce(new ConflictException('Sin stock')); // PRODUCT_B fails
      productService.releaseStock.mockResolvedValue(undefined);

      await consumer.handleOrderPlaced({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      });

      // Debe liberar solo el producto que fue reservado exitosamente
      expect(productService.releaseStock).toHaveBeenCalledTimes(1);
      expect(productService.releaseStock).toHaveBeenCalledWith(PRODUCT_A, 2, ORDER_ID);
    });

    it('does not throw even when rollback fails', async () => {
      productService.reserveStock
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ConflictException('Sin stock'));
      productService.releaseStock.mockRejectedValue(new Error('DB error'));

      await expect(
        consumer.handleOrderPlaced({
          orderId: ORDER_ID,
          storeId: STORE_ID,
          items: [
            { productId: PRODUCT_A, quantity: 2 },
            { productId: PRODUCT_B, quantity: 1 },
          ],
        }),
      ).resolves.toBeUndefined();
    });

    it('handles single-item orders without rollback when the only item fails', async () => {
      productService.reserveStock.mockRejectedValue(new ConflictException('Sin stock'));

      await consumer.handleOrderPlaced({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [{ productId: PRODUCT_A, quantity: 5 }],
      });

      expect(productService.releaseStock).not.toHaveBeenCalled();
    });
  });

  // ── handleOrderConfirmed ─────────────────────────────────────────────────

  describe('handleOrderConfirmed', () => {
    it('confirms reservation for all items', async () => {
      productService.confirmReservation.mockResolvedValue(undefined);

      await consumer.handleOrderConfirmed({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      });

      expect(productService.confirmReservation).toHaveBeenCalledTimes(2);
      expect(productService.confirmReservation).toHaveBeenCalledWith(PRODUCT_A, 2, ORDER_ID);
      expect(productService.confirmReservation).toHaveBeenCalledWith(PRODUCT_B, 1, ORDER_ID);
    });

    it('continues processing remaining items even if one confirmation fails', async () => {
      productService.confirmReservation
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      await consumer.handleOrderConfirmed({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      });

      expect(productService.confirmReservation).toHaveBeenCalledTimes(2);
    });

    it('does not throw when all confirmations fail', async () => {
      productService.confirmReservation.mockRejectedValue(new Error('DB error'));

      await expect(
        consumer.handleOrderConfirmed({
          orderId: ORDER_ID,
          storeId: STORE_ID,
          items: [{ productId: PRODUCT_A, quantity: 2 }],
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ── handleOrderCancelled ─────────────────────────────────────────────────

  describe('handleOrderCancelled', () => {
    it('releases stock for all items', async () => {
      productService.releaseStock.mockResolvedValue(undefined);

      await consumer.handleOrderCancelled({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      });

      expect(productService.releaseStock).toHaveBeenCalledTimes(2);
      expect(productService.releaseStock).toHaveBeenCalledWith(PRODUCT_A, 2, ORDER_ID);
      expect(productService.releaseStock).toHaveBeenCalledWith(PRODUCT_B, 1, ORDER_ID);
    });

    it('continues releasing remaining items even if one release fails', async () => {
      productService.releaseStock
        .mockRejectedValueOnce(new Error('product not found'))
        .mockResolvedValueOnce(undefined);

      await consumer.handleOrderCancelled({
        orderId: ORDER_ID,
        storeId: STORE_ID,
        items: [
          { productId: PRODUCT_A, quantity: 2 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      });

      expect(productService.releaseStock).toHaveBeenCalledTimes(2);
    });

    it('does not throw when all releases fail', async () => {
      productService.releaseStock.mockRejectedValue(new Error('DB error'));

      await expect(
        consumer.handleOrderCancelled({
          orderId: ORDER_ID,
          storeId: STORE_ID,
          items: [{ productId: PRODUCT_A, quantity: 2 }],
        }),
      ).resolves.toBeUndefined();
    });
  });
});
