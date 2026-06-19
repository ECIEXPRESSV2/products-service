import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryMovementRepository } from './repositories/inventory-movement.repository';
import { INVENTORY_MOVEMENT_REPOSITORY } from './repositories/inventory-movement.repository.interface';
import { InventoryService } from './services/inventory.service';
import { INVENTORY_SERVICE } from './services/inventory.service.interface';
import { InventoryController } from './controllers/inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryMovement])],
  controllers: [InventoryController],
  providers: [
    { provide: INVENTORY_MOVEMENT_REPOSITORY, useClass: InventoryMovementRepository },
    { provide: INVENTORY_SERVICE, useClass: InventoryService },
  ],
  exports: [INVENTORY_SERVICE],
})
export class InventoryModule {}
