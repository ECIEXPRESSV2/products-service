import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { IStoreRepository } from '../repositories/store.repository.interface';
import { STORE_REPOSITORY } from '../repositories/store.repository.interface';
import { Store } from '../entities/store.entity';
import { RequireRoles } from '../../../common/decorators/require-roles.decorator';

@ApiTags('Stores')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token ausente o inválido' })
@ApiForbiddenResponse({ description: 'Rol sin permiso para esta operación' })
@RequireRoles('VENDOR', 'ADMIN', 'ANALYST')
@Controller('stores')
export class StoreController {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly storeRepository: IStoreRepository,
  ) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar réplica local de una tienda',
    description:
      'Devuelve el último snapshot sincronizado desde identity-service. ' +
      'Útil para depuración; products-service no es la fuente de verdad de esta entidad.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: Store })
  @ApiResponse({ status: 404, description: 'Tienda no encontrada en la réplica local' })
  async findById(@Param('id') id: string): Promise<Store> {
    const store = await this.storeRepository.findById(id);
    if (!store) {
      throw new NotFoundException(`Tienda con id "${id}" no encontrada en la réplica local`);
    }
    return store;
  }
}
