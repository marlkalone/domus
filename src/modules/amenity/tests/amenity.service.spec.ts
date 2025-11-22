import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { AmenityService } from "../amenity.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Project } from "../../../infra/database/entities/project.entity";
import { Amenity } from "../../../infra/database/entities/amenity.entity";
import {
  AmenityCategory,
  AmenityCondition,
} from "../../../common/enums/amenity.enum";
import { AmenityRepository } from "../repository/amenity.repository";
import { ProjectService } from "../../project/project.service";
import { AttachmentService } from "../../attachment/attachment.service";
import { LogService } from "../../log/log.service";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { CreateAmenityDTO } from "../dto/create-amenity.dto";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { ReadAmenityDTO } from "../dto/read-amenity.dto";
import { AmenityFilterDTO } from "../dto/amenity-filter.dto";
import { UpdateAmenityDTO } from "../dto/update-amenity.dto";

// Mock do EntityManager (é apenas um objeto de passagem para os repositórios)
const mockEntityManager = {} as EntityManager;

describe("AmenityService", () => {
  let service: AmenityService;
  let mockAmenityRepo: any;
  let mockProjectService: any;
  let mockAttachmentService: any;
  let mockLogService: any;
  let mockTxManager: any;

  const mockUser: User = { id: 1 } as any;
  const mockProject: Project = { id: 1, user: mockUser } as any;

  const mockAmenity: Amenity = {
    id: 1,
    name: "Test Amenity",
    category: AmenityCategory.FINISHING,
    condition: AmenityCondition.GOOD,
    quantity: 1,
    version: 0,
    project: mockProject,
    attachments: [],
  } as any;

  let testMockAmenity: Amenity;

  beforeEach(async () => {
    testMockAmenity = JSON.parse(JSON.stringify(mockAmenity));

    // Inicialização dos mocks
    mockAmenityRepo = {
      createAndSave: jest.fn(),
      findOneByIds: jest.fn(),
      countTotalAmenities: jest.fn(),
      findFilteredPaginated: jest.fn(),
      countByCategoryForProject: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    mockProjectService = {
      findOne: jest.fn(),
    };
    mockAttachmentService = {
      createRecordsWithManager: jest.fn(),
      removeAllForOwnerWithManager: jest.fn(),
    };
    mockLogService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logDelete: jest.fn(),
    };
    mockTxManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockEntityManager as unknown as EntityManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmenityService,
        { provide: AmenityRepository, useValue: mockAmenityRepo },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: LogService, useValue: mockLogService },
        { provide: TransactionManagerService, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<AmenityService>(AmenityService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const userId = 1;
    const createDto: CreateAmenityDTO = {
      projectId: 1,
      name: "New Amenity",
      description: "...",
      condition: AmenityCondition.EXCELLENT,
      category: AmenityCategory.LEISURE,
      quantity: 1,
      attachmentKeys: [
        { key: "key1", originalName: "doc.pdf", mimeType: "app/pdf" },
      ],
    };

    it("should create an amenity with attachments", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockAmenityRepo.createAndSave.mockResolvedValue(testMockAmenity);
      mockAttachmentService.createRecordsWithManager.mockResolvedValue([]);
      mockAmenityRepo.findOneByIds.mockResolvedValue(testMockAmenity); // Chamada final

      const result = await service.create(userId, createDto);

      expect(result).toEqual(testMockAmenity);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        userId,
        createDto.projectId,
      );
      expect(mockAmenityRepo.createAndSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Amenity", project: mockProject }),
        mockEntityManager as unknown as EntityManager,
      );
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.AMENITY,
        testMockAmenity.id,
        createDto.attachmentKeys,
      );
      expect(mockLogService.logCreate).toHaveBeenCalled();
    });

    it("should throw NotFoundException if project not found", async () => {
      mockProjectService.findOne.mockRejectedValue(
        new NotFoundException("Project not found"),
      );

      await expect(service.create(userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    const readDto: ReadAmenityDTO = { projectId: 1, amenityId: 1 };

    it("should return an amenity", async () => {
      mockAmenityRepo.findOneByIds.mockResolvedValue(testMockAmenity);

      const result = await service.findOne(1, readDto);

      expect(result).toEqual(testMockAmenity);
      expect(mockAmenityRepo.findOneByIds).toHaveBeenCalledWith(1, 1, 1);
    });

    it("should throw NotFoundException if amenity not found", async () => {
      mockAmenityRepo.findOneByIds.mockResolvedValue(null);

      await expect(service.findOne(1, readDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("listProjectAmenity", () => {
    const filter: AmenityFilterDTO = { projectId: 1, skip: 0, limit: 10 };

    it("should aggregate list, counts, and category counts", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockAmenityRepo.findFilteredPaginated.mockResolvedValue({
        items: [testMockAmenity],
        total: 1,
      });
      mockAmenityRepo.countTotalAmenities.mockResolvedValue(1);
      mockAmenityRepo.countByCategoryForProject.mockResolvedValue([
        { category: AmenityCategory.FINISHING, total: "1" },
      ]);

      const result = await service.listProjectAmenity(1, filter);

      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        1,
        filter.projectId,
      );
      expect(result.data[0]).toEqual(testMockAmenity);
      expect(result.total).toBe(1);
      expect(result.totalCount).toBe(1);
      expect(result.totalByCategory[AmenityCategory.FINISHING]).toBe(1);
      expect(result.totalByCategory[AmenityCategory.LEISURE]).toBe(0); // Garante que foi zerado
    });
  });

  describe("update", () => {
    const userId = 1;
    const projectId = 1;
    const amenityId = 1;
    const updateDto: UpdateAmenityDTO = {
      id: 1,
      projectId: 1,
      version: 0,
      name: "Updated Name",
      condition: AmenityCondition.POOR,
      attachmentKeys: [],
    };

    it("should update an amenity and sync attachments", async () => {
      mockAmenityRepo.findOneByIds.mockResolvedValue(testMockAmenity);
      mockAmenityRepo.save.mockResolvedValue(true);
      mockAttachmentService.removeAllForOwnerWithManager.mockResolvedValue();
      mockAmenityRepo.findOneByIds
        .mockResolvedValueOnce(testMockAmenity)
        .mockResolvedValueOnce({
          ...testMockAmenity,
          ...updateDto,
          version: 1,
        });

      const result = await service.update(
        userId,
        projectId,
        amenityId,
        updateDto,
      );

      expect(result.name).toBe("Updated Name");
      expect(result.version).toBe(1);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockAmenityRepo.findOneByIds).toHaveBeenCalledWith(
        userId,
        projectId,
        amenityId,
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockAmenityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Name", version: 1 }),
        mockEntityManager as unknown as EntityManager,
      );
      // Sincronia de anexos (remoção)
      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalled();
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if user ID does not match", async () => {
      const otherUserAmenity = {
        ...testMockAmenity,
        project: { user: { id: 2 } },
      };
      mockAmenityRepo.findOneByIds.mockResolvedValue(otherUserAmenity);

      await expect(
        service.update(userId, projectId, amenityId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException on version mismatch", async () => {
      const mismatchedDto = { ...updateDto, version: 1 };
      mockAmenityRepo.findOneByIds.mockResolvedValue(testMockAmenity);

      await expect(
        service.update(userId, projectId, amenityId, mismatchedDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("should remove an amenity and its attachments", async () => {
      mockAmenityRepo.findOneByIds.mockResolvedValue(testMockAmenity);

      await service.remove({ userId: 1, projectId: 1, amenityId: 1 });

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockAmenityRepo.findOneByIds).toHaveBeenCalledWith(
        1,
        1,
        1,
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logDelete).toHaveBeenCalled();
      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.AMENITY,
        testMockAmenity.id,
      );
      expect(mockAmenityRepo.remove).toHaveBeenCalledWith(
        testMockAmenity,
        mockEntityManager as unknown as EntityManager,
      );
    });
  });
});
