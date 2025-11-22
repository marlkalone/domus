import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { Attachment } from "../../../infra/database/entities/attachment.entity";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";

@Injectable()
export class AttachmentRepository {
  constructor(
    @InjectRepository(Attachment)
    private readonly repo: Repository<Attachment>,
  ) {}

  /**
   * Obtém o repositório, usando o EntityManager transacional se fornecido,
   * ou o repositório padrão injetado caso contrário.
   */
  private getRepository(manager?: EntityManager): Repository<Attachment> {
    return manager ? manager.getRepository(Attachment) : this.repo;
  }

  // ===================================================================
  // MÉTODOS BASE (com 'manager' opcional)
  // ===================================================================

  create(data: Partial<Attachment>, manager?: EntityManager): Attachment {
    return this.getRepository(manager).create(data);
  }

  save(
    attachments: Attachment | Attachment[],
    manager?: EntityManager,
  ): Promise<Attachment[]> {
    const entities = Array.isArray(attachments) ? attachments : [attachments];
    return this.getRepository(manager).save(entities);
  }

  async findById(id: number, manager?: EntityManager): Promise<Attachment> {
    const att = await this.getRepository(manager).findOne({ where: { id } });
    if (!att) {
      throw new NotFoundException(`Attachment #${id} not found`);
    }
    return att;
  }

  async deleteById(id: number, manager?: EntityManager): Promise<void> {
    const result = await this.getRepository(manager).delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Attachment #${id} not found`);
    }
  }

  findByOwner(
    ownerType: AttachmentOwnerType,
    ownerId: number,
    manager?: EntityManager,
  ): Promise<Attachment[]> {
    return this.getRepository(manager).find({ where: { ownerType, ownerId } });
  }

  async deleteByOwner(
    ownerType: AttachmentOwnerType,
    ownerId: number,
    manager?: EntityManager,
  ): Promise<void> {
    await this.getRepository(manager).delete({ ownerType, ownerId });
  }

  // ===================================================================
  // MÉTODOS TRANSACIONAIS
  // (Chamados pelo AttachmentService de dentro de uma transação)
  // ===================================================================

  createWithManager(
    manager: EntityManager,
    data: Partial<Attachment>,
  ): Attachment {
    return this.create(data, manager);
  }

  saveWithManager(
    manager: EntityManager,
    attachments: Attachment | Attachment[],
  ): Promise<Attachment[]> {
    return this.save(attachments, manager);
  }

  async findByIdWithManager(
    manager: EntityManager,
    id: number,
  ): Promise<Attachment> {
    return this.findById(id, manager);
  }

  async deleteByIdWithManager(
    manager: EntityManager,
    id: number,
  ): Promise<void> {
    return this.deleteById(id, manager);
  }

  findByOwnerWithManager(
    manager: EntityManager,
    ownerType: AttachmentOwnerType,
    ownerId: number,
  ): Promise<Attachment[]> {
    return this.findByOwner(ownerType, ownerId, manager);
  }

  async deleteByOwnerWithManager(
    manager: EntityManager,
    ownerType: AttachmentOwnerType,
    ownerId: number,
  ): Promise<void> {
    return this.deleteByOwner(ownerType, ownerId, manager);
  }
}
