import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import type { IStoreRepository } from '../repositories/store.repository.interface';
import { STORE_REPOSITORY } from '../repositories/store.repository.interface';

/**
 * Helper inyectable para validar storeId contra la réplica local de Stores
 * antes de crear categorías o productos. Otros módulos lo inyectan
 * directamente (igual que CATEGORY_REPOSITORY es inyectado por ProductService)
 * en lugar de pasar por StoresModule's exported service.
 */
@Injectable()
export class StoreValidator {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly storeRepository: IStoreRepository,
  ) {}

  async assertActive(storeId: string): Promise<void> {
    const store = await this.storeRepository.findById(storeId);
    if (!store) {
      throw new NotFoundException(
        `La tienda "${storeId}" no existe o aún no ha sido sincronizada desde identity-service`,
      );
    }
    if (!store.isActive) {
      throw new ConflictException(`La tienda "${storeId}" está inactiva`);
    }
  }
}
