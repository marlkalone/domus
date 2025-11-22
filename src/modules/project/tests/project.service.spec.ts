import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ProjectService } from "../project.service";
import { AddressDTO } from "../../../common/utils/address.dto";
import { Project } from "../../../infra/database/entities/project.entity";
import {
  AcquisitionType,
  ProjectStatus,
} from "../../../common/enums/project.enum";
import { User } from "../../../infra/database/entities/user.entity";
import { ProjectAddress } from "../../../infra/database/entities/projectAddress.entity";
import { ProjectDetail } from "../../../infra/database/entities/projectDetail.entity";
import { Attachment } from "../../../infra/database/entities/attachment.entity";
import { CreateProjectDTO } from "../dto/create-project.dto";
import { ProjectRepository } from "../repository/project.repository";
import { AttachmentService } from "../../attachment/attachment.service";
import { LogService } from "../../log/log.service";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { ProjectFilterDTO } from "../dto/project-filter.dto";
import { PaginationResponse } from "../../../common/utils/pagination-response";
import { UpdateProjectDTO } from "../dto/update-project.dto";

const mockEntityManager = {
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
};

describe("ProjectService", () => {
  let service: ProjectService;
  let mockProjectRepository: any;
  let mockAttachmentService: any;
  let mockLogService: any;
  let mockTxManagerService: any;

  const mockAddressDto: AddressDTO = {
    zipCode: "12345-678",
    street: "Test St",
    number: "100",
    neighborhood: "Test Neighborhood",
    city: "Test City",
    state: "TS",
  };

  const mockProject: Project = {
    id: 1,
    title: "Test Project",
    acquisitionType: AcquisitionType.PURCHASE,
    status: ProjectStatus.PLANNING,
    acquisitionPrice: 100000,
    targetSalePrice: 200000,
    version: 0,
    user: { id: 1 } as User,
    address: { id: 1, ...mockAddressDto } as ProjectAddress,
    details: [
      { id: 1, key: "bedrooms", value: "3", project: {} } as ProjectDetail,
    ],
    attachments: [
      { id: 1, url: "key1.jpg", originalName: "pic.jpg" } as Attachment,
    ],
    amenities: [],
    tasks: [],
    transactions: [],
    billings: [],
  };

  const mockCreateDto: CreateProjectDTO = {
    title: "New Project",
    acquisition_type: AcquisitionType.AUCTION,
    status: ProjectStatus.PRE_ACQUISITION,
    acquisitionPrice: 50000,
    targetSalePrice: 100000,
    address: mockAddressDto,
    details: [{ key: "area", value: "100" }],
    attachs: [
      { key: "key_new.pdf", originalName: "doc.pdf", mimeType: "app/pdf" },
    ],
  };

  beforeEach(async () => {
    mockProjectRepository = {
      createWithManager: jest.fn(),
      saveWithManager: jest.fn(),
      findOneByIdAndUser: jest.fn(),
      findAllPaginated: jest.fn(),
      countByStatusForUser: jest.fn(),
      countCollaborators: jest.fn(),
      findOneByIdWithManager: jest.fn(),
      deleteWithManager: jest.fn(),
      countAll: jest.fn(),
    };

    mockAttachmentService = {
      createRecordsWithManager: jest.fn(),
      queueCleanupJob: jest.fn(),
      removeAllForOwnerWithManager: jest.fn(),
    };

    mockLogService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logDelete: jest.fn(),
    };

    mockTxManagerService = {
      run: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockEntityManager as unknown as EntityManager);
      }),
    };

    mockEntityManager.create.mockClear();
    mockEntityManager.save.mockClear();
    mockEntityManager.remove.mockClear();
    mockEntityManager.findOne.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: mockProjectRepository },
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: LogService, useValue: mockLogService },
        { provide: TransactionManagerService, useValue: mockTxManagerService },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a project with address, details, and attachments", async () => {
      const userId = 1;
      const createdProject = { ...mockProject, ...mockCreateDto, id: 2 };
      const savedProject = { id: 2 }; // Simula o retorno inicial do save

      mockProjectRepository.createWithManager.mockReturnValue(createdProject);
      mockProjectRepository.saveWithManager.mockResolvedValue(savedProject);

      // Mocks para entidades relacionadas
      mockEntityManager.create.mockImplementation((entityType, data) => ({
        ...data,
      }));
      mockEntityManager.save.mockResolvedValue(true);

      mockEntityManager.findOne.mockResolvedValue(createdProject);

      const result = await service.create(userId, mockCreateDto);

      expect(result).toEqual(createdProject);
      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockProjectRepository.createWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ title: "New Project", user: { id: userId } }),
      );
      expect(mockProjectRepository.saveWithManager).toHaveBeenCalled();

      // Endereço
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        ProjectAddress,
        expect.objectContaining({ zipCode: "12345-678" }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ zipCode: "12345-678" }),
      );

      // Detalhes
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        ProjectDetail,
        expect.objectContaining({ key: "area", value: "100" }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ key: "area" })]),
      );
      // Anexos
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        savedProject.id,
        mockCreateDto.attachs,
      );

      // Log
      expect(mockLogService.logCreate).toHaveBeenCalledWith(
        mockEntityManager,
        userId,
        "Project",
        createdProject,
      );
    });
  });

  describe("findOne", () => {
    it("should return a project if found", async () => {
      mockProjectRepository.findOneByIdAndUser.mockResolvedValue(mockProject);

      const result = await service.findOne(1, 1);

      expect(result).toEqual(mockProject);
      expect(mockProjectRepository.findOneByIdAndUser).toHaveBeenCalledWith(
        1,
        1,
      );
    });

    it("should throw NotFoundException if project not found", async () => {
      mockProjectRepository.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.findOne(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return paginated projects", async () => {
      const filter: ProjectFilterDTO = { skip: 0, limit: 10 };
      const responseData: [Project[], number] = [[mockProject], 1];
      mockProjectRepository.findAllPaginated.mockResolvedValue(responseData);

      const result = await service.findAll(1, filter);

      const expectedResponse: PaginationResponse<Project> = {
        data: [mockProject],
        total: 1,
        page: 1,
        limit: 10,
      };

      expect(result).toEqual(expectedResponse);
      expect(mockProjectRepository.findAllPaginated).toHaveBeenCalledWith(
        1,
        filter,
      );
    });
  });

  describe("update", () => {
    const userId = 1;
    const projectId = 1;

    const updateDto: UpdateProjectDTO = {
      version: 0,
      title: "Updated Title",
      status: ProjectStatus.RENOVATION,
      acquisition_type: AcquisitionType.PURCHASE,
      acquisitionPrice: 110000,
      targetSalePrice: 210000,
      address: mockAddressDto,
      details: [],
      attachmentKeys: [],
    };

    let mockExistingProject: Project;

    beforeEach(() => {
      mockExistingProject = JSON.parse(JSON.stringify(mockProject));
    });

    it("should throw NotFoundException if project does not exist", async () => {
      mockProjectRepository.findOneByIdWithManager.mockResolvedValue(null);

      await expect(
        service.update(userId, projectId, updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(mockTxManagerService.run).toHaveBeenCalled();
    });

    it("should throw BadRequestException if version mismatches", async () => {
      mockProjectRepository.findOneByIdWithManager.mockResolvedValue(
        mockExistingProject,
      );

      await expect(
        service.update(userId, projectId, { ...updateDto, version: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update primary fields and address", async () => {
      mockProjectRepository.findOneByIdWithManager.mockResolvedValue(
        mockExistingProject,
      );
      mockEntityManager.findOne.mockResolvedValue(mockExistingProject);

      await service.update(userId, projectId, updateDto);

      expect(mockLogService.logUpdate).toHaveBeenCalled();

      expect(mockProjectRepository.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        expect.objectContaining({ title: "Updated Title", version: 1 }),
      );

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        ProjectAddress,
        expect.objectContaining(mockExistingProject.address),
      );
    });

    it("should correctly add, update, and remove details", async () => {
      // Config: 'bedrooms' (existente) será atualizado, 'area' (novo) será adicionado, 'to_delete' (existente) será removido.
      const detailToUpdate = {
        id: 1,
        key: "bedrooms",
        value: "3",
        project: mockExistingProject,
      };
      const detailToDelete = {
        id: 2,
        key: "to_delete",
        value: "true",
        project: mockExistingProject,
      };

      mockExistingProject.details = [detailToUpdate, detailToDelete];

      const dtoWithDetails = {
        ...updateDto,
        details: [
          { key: "bedrooms", value: "4" }, // Update
          { key: "area", value: "150" }, // Add
        ],
      };

      mockProjectRepository.findOneByIdWithManager.mockResolvedValue(
        mockExistingProject as any,
      );
      mockEntityManager.findOne.mockResolvedValue(mockExistingProject as any);
      mockEntityManager.create.mockImplementation((_, data) => data); // Simula o create

      await service.update(userId, projectId, dtoWithDetails);

      expect(mockEntityManager.remove).toHaveBeenCalledWith([detailToDelete]);

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: "bedrooms", value: "4" }), // Atualizado
          expect.objectContaining({ key: "area", value: "150" }), // Adicionado
        ]),
      );
    });

    it("should correctly add and remove attachments", async () => {
      // Config: 'key1.jpg' (existente) será mantido, 'key_to_add.png' (novo) será adicionado, 'key_to_delete.pdf' (existente) será removido.
      const attachmentToKeep = {
        id: 1,
        url: "key1.jpg",
        originalName: "pic.jpg",
      };
      const attachmentToDelete = {
        id: 2,
        url: "key_to_delete.pdf",
        originalName: "old_doc.pdf",
      };

      mockExistingProject.attachments = [
        attachmentToKeep,
        attachmentToDelete,
      ] as Attachment[];

      const dtoWithAttachments = {
        ...updateDto,
        attachmentKeys: [
          { key: "key1.jpg", originalName: "pic.jpg", mimeType: "image/jpeg" }, // Manter
          {
            key: "key_to_add.png",
            originalName: "new_pic.png",
            mimeType: "image/png",
          }, // Adicionar
        ],
      };

      mockProjectRepository.findOneByIdWithManager.mockResolvedValue(
        mockExistingProject as any,
      );
      mockEntityManager.findOne.mockResolvedValue(mockExistingProject as any);

      await service.update(userId, projectId, dtoWithAttachments);

      expect(mockEntityManager.remove).toHaveBeenCalledWith([
        attachmentToDelete,
      ]);
      expect(mockAttachmentService.queueCleanupJob).toHaveBeenCalledWith(
        "key_to_delete.pdf",
      );

      expect(
        mockAttachmentService.createRecordsWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        projectId,
        [expect.objectContaining({ key: "key_to_add.png" })],
      );
    });
  });

  describe("remove", () => {
    it("should remove a project and its attachments", async () => {
      mockProjectRepository.findOneByIdAndUser.mockResolvedValue(mockProject);

      await service.remove(1, 1);

      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockProjectRepository.findOneByIdAndUser).toHaveBeenCalledWith(
        1,
        1,
      );
      expect(mockLogService.logDelete).toHaveBeenCalledWith(
        mockEntityManager,
        1,
        "Project",
        mockProject,
      );

      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.PROJECT,
        mockProject.id,
      );

      expect(mockProjectRepository.deleteWithManager).toHaveBeenCalledWith(
        mockEntityManager,
        mockProject,
      );
    });

    it("should throw NotFoundException if project not found on remove", async () => {
      mockProjectRepository.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.remove(1, 99)).rejects.toThrow(NotFoundException);
      expect(mockLogService.logDelete).not.toHaveBeenCalled();
    });
  });
});
