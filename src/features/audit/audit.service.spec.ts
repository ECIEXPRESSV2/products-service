import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditService, CreateAuditLogDto } from './audit.service';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLog>>;

  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const repoMock = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<AuditLog>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: repoMock },
        { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(AuditService);
    repo = repoMock;
  });

  describe('log', () => {
    const dto: CreateAuditLogDto = {
      entityName: 'Category',
      entityId: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
      action: AuditAction.CREATE,
      afterData: { id: 'a3bb189e', name: 'Bebidas' },
    };

    it('creates and saves an audit log entry', async () => {
      const entry = { ...dto } as AuditLog;
      repo.create.mockReturnValue(entry);
      repo.save.mockResolvedValue(entry);

      await service.log(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityName: 'Category',
          action: AuditAction.CREATE,
          performedBy: 'system',
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(entry);
    });

    it('does not throw when save fails (swallows error)', async () => {
      repo.create.mockReturnValue({} as AuditLog);
      repo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.log(dto)).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('uses provided performedBy value', async () => {
      const dtoWithUser = { ...dto, performedBy: 'admin-user' };
      repo.create.mockReturnValue({} as AuditLog);
      repo.save.mockResolvedValue({} as AuditLog);

      await service.log(dtoWithUser);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ performedBy: 'admin-user' }),
      );
    });
  });

  describe('findByEntity', () => {
    it('returns audit logs for a specific entity ordered by createdAt DESC', async () => {
      const logs = [{ id: 'log-1' } as AuditLog];
      repo.find.mockResolvedValue(logs);

      const result = await service.findByEntity('Category', 'cat-id');

      expect(repo.find).toHaveBeenCalledWith({
        where: { entityName: 'Category', entityId: 'cat-id' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(logs);
    });
  });

  describe('findAll', () => {
    it('returns all logs with default pagination', async () => {
      const logs = [{ id: 'log-1' } as AuditLog];
      repo.find.mockResolvedValue(logs);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 100,
        skip: 0,
      });
      expect(result).toBe(logs);
    });

    it('applies custom limit and offset', async () => {
      repo.find.mockResolvedValue([]);

      await service.findAll(50, 100);

      expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 50, skip: 100 }));
    });
  });
});
