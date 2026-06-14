import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  READ = 'READ',
}

@Entity('audit_logs')
@Index('IDX_audit_logs_entity', ['entityName', 'entityId'])
@Index('IDX_audit_logs_created_at', ['createdAt'])
export class AuditLog {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Category', description: 'Nombre de la entidad afectada' })
  @Column({ name: 'entity_name', type: 'varchar', length: 100 })
  entityName: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @ApiProperty({ enum: AuditAction, example: AuditAction.CREATE })
  @Column({ type: 'varchar', length: 20 })
  action: AuditAction;

  @ApiPropertyOptional({ description: 'Snapshot del estado anterior (JSON)' })
  @Column({ name: 'before_data', type: 'jsonb', nullable: true })
  beforeData: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Snapshot del estado posterior (JSON)' })
  @Column({ name: 'after_data', type: 'jsonb', nullable: true })
  afterData: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Metadata adicional del contexto' })
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ example: '192.168.1.1', description: 'IP del solicitante' })
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @ApiProperty({ example: 'system', description: 'Usuario o servicio que realizó la acción' })
  @Column({ name: 'performed_by', type: 'varchar', length: 255, default: 'system' })
  performedBy: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
