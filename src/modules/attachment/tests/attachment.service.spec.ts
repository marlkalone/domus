import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { AttachmentService } from "../attachment.service";
import { Attachment } from "../../../infra/database/entities/attachment.entity";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { StorageService } from "../../../infra/storage/storage.service";
import { AttachmentRepository } from "../repository/attachment.repository";
import { QueueProducerService } from "../../../infra/queue/queue.producer.service";
import { PresignAttachmentDTO } from "../dto/attachment.dto";

jest.mock("uuid", () => ({
  v4: () => "mock-uuid",
}));

describe("AttachmentService", () => {
  let service: AttachmentService;
  let mockStorageService: any;
  let mockAttachmentRepo: any;
  let mockQueueProducerService: any;

  const mockEntityManager = {} as EntityManager;

  const mockAttachment: Attachment = {
    id: 1,
    ownerType: AttachmentOwnerType.PROJECT,
    ownerId: 1,
    url: "mock-key.pdf",
    originalName: "doc.pdf",
    mimeType: "application/pdf",
  } as any;

  const mockKeyDto = {
    key: "mock-key.pdf",
    originalName: "doc.pdf",
    mimeType: "application/pdf",
  };

  beforeEach(async () => {
    mockStorageService = {
      getUploadUrl: jest.fn(),
      getFileUrlFromS3: jest.fn(),
    };
    mockAttachmentRepo = {
      createWithManager: jest.fn(),
      saveWithManager: jest.fn(),
      findById: jest.fn(),
      deleteById: jest.fn(),
      findByIdWithManager: jest.fn(),
      deleteByIdWithManager: jest.fn(),
      findByOwnerWithManager: jest.fn(),
      deleteByOwnerWithManager: jest.fn(),
    };
    mockQueueProducerService = {
      sendStorageCleanupJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: AttachmentRepository, useValue: mockAttachmentRepo },
        { provide: QueueProducerService, useValue: mockQueueProducerService },
      ],
    }).compile();

    service = module.get<AttachmentService>(AttachmentService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("presignUrls", () => {
    it("should return presigned URLs for allowed mime types", async () => {
      const dto: PresignAttachmentDTO = {
        files: [
          { originalName: "image.jpg", mimeType: "image/jpeg" },
          { originalName: "doc.pdf", mimeType: "application/pdf" },
        ],
      };
      mockStorageService.getUploadUrl.mockResolvedValue(
        "http://mock-upload.url",
      );

      const result = await service.presignUrls(dto);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("mock-uuid-image.jpg");
      expect(result[0].uploadUrl).toBe("http://mock-upload.url");
      expect(mockStorageService.getUploadUrl).toHaveBeenCalledTimes(2);
    });

    it("should throw BadRequestException for unsupported mime types", async () => {
      const dto: PresignAttachmentDTO = {
        files: [
          { originalName: "virus.exe", mimeType: "application/octet-stream" },
        ],
      };

      await expect(service.presignUrls(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockStorageService.getUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe("createRecordsWithManager", () => {
    it("should create and save attachment records", async () => {
      mockAttachmentRepo.createWithManager.mockReturnValue(mockAttachment);
      mockAttachmentRepo.saveWithManager.mockResolvedValue([mockAttachment]);

      const result = await service.createRecordsWithManager(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        1,
        [mockKeyDto],
      );

      expect(result).toEqual([mockAttachment]);
      expect(mockAttachmentRepo.createWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ url: "mock-key.pdf" }),
      );
      expect(mockAttachmentRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        [mockAttachment],
      );
    });
  });

  describe("findById", () => {
    it("should return an attachment if found", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      const result = await service.findById(1);
      expect(result).toEqual(mockAttachment);
    });

    it("should throw NotFoundException if not found", async () => {
      mockAttachmentRepo.findById.mockImplementation(() => {
        throw new NotFoundException(`Attachment #99 not found`);
      });
      await expect(service.findById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getDownloadUrl", () => {
    it("should return a presigned download URL", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      mockStorageService.getFileUrlFromS3.mockResolvedValue(
        "http://mock-download.url",
      );

      const result = await service.getDownloadUrl(1);

      expect(result).toBe("http://mock-download.url");
      expect(mockAttachmentRepo.findById).toHaveBeenCalledWith(1);
      expect(mockStorageService.getFileUrlFromS3).toHaveBeenCalledWith(
        "mock-key.pdf",
        3600,
      );
    });

    it("should throw ServiceUnavailableException if S3 fails", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(mockAttachment);
      mockStorageService.getFileUrlFromS3.mockRejectedValue(
        new Error("S3 Error"),
      );

      await expect(service.getDownloadUrl(1)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe("remove", () => {
    it("should delete record from repo and send cleanup job", async () => {
      mockAttachmentRepo.findById.mockResolvedValue(mockAttachment);

      await service.remove(1);

      expect(mockAttachmentRepo.deleteById).toHaveBeenCalledWith(1);
      expect(
        mockQueueProducerService.sendStorageCleanupJob,
      ).toHaveBeenCalledWith("mock-key.pdf");
    });
  });

  describe("removeWithManager", () => {
    it("should delete record from repo (with manager) and send cleanup job", async () => {
      mockAttachmentRepo.findByIdWithManager.mockResolvedValue(mockAttachment);

      await service.removeWithManager(mockEntityManager, 1);

      expect(mockAttachmentRepo.findByIdWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        1,
      );
      expect(mockAttachmentRepo.deleteByIdWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        1,
      );
      expect(
        mockQueueProducerService.sendStorageCleanupJob,
      ).toHaveBeenCalledWith("mock-key.pdf");
    });
  });

  describe("removeAllForOwnerWithManager", () => {
    it("should delete multiple records and send multiple cleanup jobs", async () => {
      const attachments = [
        { ...mockAttachment, id: 1, url: "key1.pdf" },
        { ...mockAttachment, id: 2, url: "key2.jpg" },
      ];
      mockAttachmentRepo.findByOwnerWithManager.mockResolvedValue(attachments);

      await service.removeAllForOwnerWithManager(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        1,
      );

      expect(mockAttachmentRepo.deleteByOwnerWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        1,
      );

      expect(
        mockQueueProducerService.sendStorageCleanupJob,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockQueueProducerService.sendStorageCleanupJob,
      ).toHaveBeenCalledWith("key1.pdf");
      expect(
        mockQueueProducerService.sendStorageCleanupJob,
      ).toHaveBeenCalledWith("key2.jpg");
    });

    it("should do nothing if no attachments are found", async () => {
      mockAttachmentRepo.findByOwnerWithManager.mockResolvedValue([]); // Nenhum anexo encontrado

      await service.removeAllForOwnerWithManager(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        1,
      );

      expect(
        mockAttachmentRepo.deleteByOwnerWithManager,
      ).not.toHaveBeenCalled();
      expect(
        mockQueueProducerService.sendStorageCleanupJob,
      ).not.toHaveBeenCalled();
    });
  });
});
