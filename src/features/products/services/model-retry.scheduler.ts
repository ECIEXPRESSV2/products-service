import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PRODUCT_REPOSITORY } from '../repositories/product.repository.interface';
import type { IProductRepository } from '../repositories/product.repository.interface';
import { ProductGenerationStatus } from '../product-generation-status';
import { ProductMediaService } from './product-media.service';
import axios from 'axios';
import type { ProductImageFile, ProductImageSet } from '../product-assets.types';
import { NotFoundException } from '@nestjs/common';

const RETRY_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RETRY_CYCLES = 12;

@Injectable()
export class ModelRetryScheduler {
  private readonly logger = new Logger(ModelRetryScheduler.name);
  private retryTimer: ReturnType<typeof setInterval> | null = null;
  private retryCycleCount = 0;

  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    private readonly productMediaService: ProductMediaService,
  ) {}

  @Cron('0 8 * * *')
  async openRetryWindow(): Promise<void> {
    this.logger.log('Ventana de reintento 3D abierta (8:00 AM)');
    this.closeRetryWindow();
    this.retryCycleCount = 0;

    await this.retryFailedModels();

    this.retryTimer = setInterval(async () => {
      this.retryCycleCount++;

      if (this.retryCycleCount >= MAX_RETRY_CYCLES) {
        this.closeRetryWindow();
        this.logger.log('Ventana de reintento 3D cerrada (9:00 AM)');
        return;
      }

      await this.retryFailedModels();
    }, RETRY_INTERVAL_MS);
  }

  private closeRetryWindow(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async retryFailedModels(): Promise<void> {
    try {
      const failed = await this.productRepository.findFailedGenerations();
      if (failed.length === 0) {
        this.logger.log('No hay productos con generación 3D fallida — cerrando ventana');
        this.closeRetryWindow();
        return;
      }
      const remainingCycles = MAX_RETRY_CYCLES - this.retryCycleCount;
      this.logger.log(`Reintentando ${failed.length} producto(s)… (ventana: ciclo ${this.retryCycleCount + 1}/${MAX_RETRY_CYCLES}, quedan ${remainingCycles} intento(s))`);
      let succeeded = 0;
      for (const product of failed) {
        try {
          await this.retryOne(product);
          succeeded++;
        } catch (error) {
          this.logger.error(
            `Error reintentando modelo 3D para producto ${product.id}: ${(error as Error).message}`,
          );
        }
      }
      this.logger.log(`Ciclo completado: ${succeeded}/${failed.length} exitosos`);
    } catch (error) {
      this.logger.error({ err: error }, 'Error en el reintento diario de modelos 3D');
    }
  }

  private async retryOne(product: { id: string; frontImageUrl?: string | null; leftImageUrl?: string | null; backImageUrl?: string | null }): Promise<void> {
    if (!product.frontImageUrl || !product.leftImageUrl || !product.backImageUrl) {
      throw new NotFoundException('El producto no tiene las imágenes necesarias');
    }

    const downloadImage = async (url: string): Promise<Buffer> => {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return Buffer.from(response.data);
    };

    const [frontBuf, leftBuf, backBuf] = await Promise.all([
      downloadImage(product.frontImageUrl),
      downloadImage(product.leftImageUrl),
      downloadImage(product.backImageUrl),
    ]);

    const files: ProductImageSet = {
      front: { buffer: frontBuf, mimetype: 'image/png', originalname: 'front.png' } as ProductImageFile,
      left: { buffer: leftBuf, mimetype: 'image/png', originalname: 'left.png' } as ProductImageFile,
      back: { buffer: backBuf, mimetype: 'image/png', originalname: 'back.png' } as ProductImageFile,
    };

    await this.productRepository.update(product.id, {
      modelGenerationStatus: ProductGenerationStatus.PROCESSING,
      modelGenerationProgress: 0,
      modelGenerationError: null,
    } as any);

    try {
      const model3dUrl = await this.productMediaService.generateAndUploadModel3d(product.id, files);
      await this.productRepository.update(product.id, {
        model3dUrl,
        modelGenerationStatus: ProductGenerationStatus.READY,
        modelGenerationProgress: 100,
        modelGenerationError: null,
      } as any);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      await this.productRepository.update(product.id, {
        modelGenerationStatus: ProductGenerationStatus.FAILED,
        modelGenerationProgress: 100,
        modelGenerationError: message,
      } as any);
    }
  }
}
