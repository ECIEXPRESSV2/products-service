import { Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

export interface CreateAuditLogDto {
  entityName: string;
  entityId?: string | null;
  action: AuditAction;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  performedBy?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    try {
      const entry = this.auditRepository.create({
        entityName: dto.entityName,
        entityId: dto.entityId ?? null,
        action: dto.action,
        beforeData: dto.beforeData ?? null,
        afterData: dto.afterData ?? null,
        metadata: dto.metadata ?? null,
        ipAddress: dto.ipAddress ?? null,
        performedBy: dto.performedBy ?? 'system',
      });
      await this.auditRepository.save(entry);
    } catch (err) {
      this.logger.error(
        `AuditService: failed to persist audit log for ${dto.entityName}#${dto.entityId ?? 'N/A'} [${dto.action}]`,
        err instanceof Error ? err.stack : String(err),
        AuditService.name,
      );
    }
  }

  findByEntity(entityName: string, entityId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({
      where: { entityName, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  findAll(limit = 100, offset = 0): Promise<AuditLog[]> {
    return this.auditRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
