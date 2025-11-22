import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
  NotFoundException,
} from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { Attachment } from "../../infra/database/entities/attachment.entity";
import { AttachmentOwnerType } from "../../common/enums/subscription.enum";
import { PresignAttachmentDTO } from "./dto/attachment.dto";
import { AttachmentRepository } from "./repository/attachment.repository";
import { EntityManager } from "typeorm";
import { StorageService } from "../../infra/storage/storage.service";
import { QueueProducerService } from "../../infra/queue/queue.producer.service";

@Injectable()
export class AttachmentService {
  private readonly allowedMimeTypes = new Set<string>([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
  ]);

  constructor(
    private readonly storageService: StorageService,
    private readonly attachmentRepo: AttachmentRepository,
    private readonly queueProducerService: QueueProducerService,
  ) {}

  // Gera urls pré-assinadas
  async presignUrls(
    dto: PresignAttachmentDTO,
  ): Promise<{ key: string; uploadUrl: string }[]> {
    for (const file of dto.files) {
      if (!this.allowedMimeTypes.has(file.mimeType)) {
        throw new BadRequestException(
          `Unsupported file type: ${file.mimeType}`,
        );
      }
    }

    return await Promise.all(
      dto.files.map(async (file) => {
        const key = `${uuidv4()}-${file.originalName}`;
        const uploadUrl = await this.storageService.getUploadUrl(
          key,
          900,
          file.mimeType,
        );
        return { key, uploadUrl };
      }),
    );
  }

  async createRecordsWithManager(
    manager: EntityManager,
    ownerType: AttachmentOwnerType,
    ownerId: number,
    keys: { key: string; originalName: string; mimeType: string }[],
  ): Promise<Attachment[]> {
    const attachments = keys.map((k) =>
      this.attachmentRepo.createWithManager(manager, {
        ownerType,
        ownerId,
        url: k.key,
        originalName: k.originalName,
        mimeType: k.mimeType,
      }),
    );
    return this.attachmentRepo.saveWithManager(manager, attachments);
  }

  async findById(id: number): Promise<Attachment> {
    const attachment = await this.attachmentRepo.findById(id);
    if (!attachment) {
      throw new NotFoundException(`Attachment #${id} not found`);
    }
    return attachment;
  }

  async getDownloadUrl(id: number, expiresInSeconds = 3600): Promise<string> {
    const attachment = await this.findById(id);

    const key = attachment.url;

    try {
      return await this.storageService.getFileUrlFromS3(key, expiresInSeconds);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Failed to generate download URL: ${err.message}`,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const attachment = await this.attachmentRepo.findById(id);
    const key = attachment.url;

    await this.attachmentRepo.deleteById(id);
    await this.queueProducerService.sendStorageCleanupJob(key);
  }

  async removeWithManager(manager: EntityManager, id: number): Promise<void> {
    const attachment = await this.attachmentRepo.findByIdWithManager(
      manager,
      id,
    );
    if (!attachment) {
      throw new NotFoundException(`Attachment #${id} not found`);
    }
    const key = attachment.url;

    await this.attachmentRepo.deleteByIdWithManager(manager, id);
    await this.queueProducerService.sendStorageCleanupJob(key);
  }

  async removeAllForOwnerWithManager(
    manager: EntityManager,
    ownerType: AttachmentOwnerType,
    ownerId: number,
  ): Promise<void> {
    const attachments = await this.attachmentRepo.findByOwnerWithManager(
      manager,
      ownerType,
      ownerId,
    );

    if (attachments.length === 0) return;

    await this.attachmentRepo.deleteByOwnerWithManager(
      manager,
      ownerType,
      ownerId,
    );

    await Promise.all(
      attachments.map((att) =>
        this.queueProducerService.sendStorageCleanupJob(att.url),
      ),
    );
  }

  public async queueCleanupJob(key: string): Promise<void> {
    await this.queueProducerService.sendStorageCleanupJob(key);
  }
}
