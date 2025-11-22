import { Test, TestingModule } from "@nestjs/testing";
import {
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { EntityManager } from "typeorm";
import { UserRepository } from "../repository/user.repository";
import { AttachmentService } from "../../attachment/attachment.service";
import { SubscriptionService } from "../../subscription/subscription.service";
import { PlanService } from "../../subscription/plan.service";
import { UserService } from "../user.service";
import { LogService } from "../../log/log.service";
import { User } from "../../../infra/database/entities/user.entity";
import { Role, UserType } from "../../../common/enums/user.enum";
import { UserAddress } from "../../../infra/database/entities/userAddress.entity";
import { Plan } from "../../../infra/database/entities/plan.entity";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { RegisterDTO } from "../../auth/dto/register.dto";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import {
  AttachmentOwnerType,
  SubscriptionStatus,
} from "../../../common/enums/subscription.enum";
import { UpdateUserDTO } from "../dto/update-user.dto";
import { UpdatePasswordDto } from "../dto/update-password.dto";
import { UserFilterDTO } from "../dto/user-filter.dto";
import { PaginationResponse } from "../../../common/utils/pagination-response";

// Mock do EntityManager
const mockEntityManager = {
  create: jest.fn((entity, data) => ({ ...data, id: Date.now() })), // Simula a criação da entidade
  save: jest.fn((entity, data) => Promise.resolve(data)), // Simula o save
};

// Mock do TransactionManagerService
const mockTxManagerService = {
  run: jest.fn().mockImplementation(async (callback) => {
    // Executa o callback imediatamente, passando o manager mockado
    return await callback(mockEntityManager as unknown as EntityManager);
  }),
};

jest.mock("bcrypt");

describe("UserService", () => {
  let service: UserService;

  let mockUserRepository: any;
  let mockAttachmentService: any;
  let mockSubscriptionService: any;
  let mockPlanService: any;
  let mockTxManagerService: any;
  let mockLogService: any;

  // Mocks de dados
  const mockUser: User = {
    id: 1,
    name: "Test User",
    email: "test@example.com",
    passwordHash: "hashed_password",
    emailVerified: false,
    phone: "123456789",
    document: "12345678900",
    type: UserType.INDIVIDUAL,
    role: Role.USER,
    version: 0,
    createdAt: new Date(),
    address: { id: 1, street: "Main St" } as UserAddress,
    attachments: [],
    contacts: [],
    projects: [],
    refreshTokens: [],
    subscriptions: [],
    taxes: [],
  };

  const mockPlan: Plan = {
    id: 1,
    code: "FREE",
    name: "Free Plan",
    price: 0,
    subscriptions: [],
    planPermissions: [],
  };

  beforeEach(async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue("hashed_password");
    (bcrypt.hash as jest.Mock).mockClear();

    mockUserRepository = {
      createAndSave: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      verifyUserExists: jest.fn(),
      findAll: jest.fn(),
      findByEmail: jest.fn(),
      delete: jest.fn(),
      getUserStats: jest.fn(),
    };

    mockAttachmentService = {
      createRecordsWithManager: jest.fn(),
      removeAllForOwnerWithManager: jest.fn(),
    };

    mockSubscriptionService = {
      ensureCustomer: jest.fn(),
    };

    mockPlanService = {
      findByCode: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: PlanService, useValue: mockPlanService },
        { provide: TransactionManagerService, useValue: mockTxManagerService },
        { provide: LogService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const registerDto: RegisterDTO = {
      name: "New User",
      email: "new@example.com",
      password: "Password123!",
      phone: "987654321",
      document: "00987654321",
      type: UserType.INDIVIDUAL,
      address: {
        zipCode: "12345",
        street: "New St",
        number: "100",
        neighborhood: "Downtown",
        city: "New City",
        state: "NS",
      },
      attachmentKeys: [
        { key: "key1", originalName: "doc.pdf", mimeType: "application/pdf" },
      ],
    };

    it("should create a new user, address, subscription, and attachments successfully", async () => {
      const newUser = { ...mockUser, id: 2, ...registerDto };

      // Configuração dos mocks para o happy path
      mockUserRepository.verifyUserExists.mockResolvedValue(false);
      mockPlanService.findByCode.mockResolvedValue(mockPlan);
      mockUserRepository.createAndSave.mockResolvedValue(newUser);
      mockAttachmentService.createRecordsWithManager.mockResolvedValue([]);
      mockSubscriptionService.ensureCustomer.mockResolvedValue("cus_123");

      const result = await service.create(registerDto);

      expect(result).toEqual(newUser);
      expect(mockUserRepository.verifyUserExists).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockPlanService.findByCode).toHaveBeenCalledWith("FREE");
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockUserRepository.createAndSave).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          passwordHash: "hashed_password",
        }),
        mockEntityManager,
      );

      // Verifica se o endereço foi criado e salvo pelo manager
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        UserAddress,
        expect.objectContaining({ zipCode: "12345" }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        UserAddress,
        expect.any(Object),
      );

      // Verifica se a subscrição foi criada e salva pelo manager
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Subscription,
        expect.objectContaining({ status: SubscriptionStatus.PENDING }),
      );
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Subscription,
        expect.any(Object),
      );

      // Verifica se os attachments foram criados
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.USER,
        newUser.id,
        registerDto.attachmentKeys,
      );

      expect(mockLogService.logCreate).toHaveBeenCalled();

      // Verifica se o customer do Stripe foi chamado FORA da transação (após o txManager.run)
      expect(mockSubscriptionService.ensureCustomer).toHaveBeenCalledWith(
        newUser.id,
      );
    });

    it("should throw ConflictException if email is already registered", async () => {
      mockUserRepository.verifyUserExists.mockResolvedValue(true);

      await expect(service.create(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockTxManagerService.run).toHaveBeenCalled(); // A verificação ocorre dentro da transação
      expect(mockPlanService.findByCode).not.toHaveBeenCalled();
    });

    it("should throw InternalServerErrorException if FREE plan is not found", async () => {
      mockUserRepository.verifyUserExists.mockResolvedValue(false);
      mockPlanService.findByCode.mockResolvedValue(null); // Plano FREE não encontrado

      await expect(service.create(registerDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockUserRepository.createAndSave).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const userId = 1;
    const updateDto: UpdateUserDTO = {
      name: "Updated Name",
      phone: "999888777",
      type: UserType.COMPANY,
      document: "111222333",
      version: 0,
      address: {
        zipCode: "54321",
        street: "Updated St",
        number: "200",
        neighborhood: "Uptown",
        city: "Updated City",
        state: "US",
      },
      attachmentKeys: [], // Remove todos os attachments
    };

    const mockUserFound: User = {
      ...mockUser,
      address: { id: 1, street: "Old St", version: 0 } as UserAddress,
      version: 0,
    };

    it("should update user details successfully", async () => {
      mockUserRepository.findById.mockResolvedValue(mockUserFound);
      mockUserRepository.verifyUserExists.mockResolvedValue(false); // Caso o email mudasse
      mockUserRepository.save.mockResolvedValue({
        ...mockUserFound,
        ...updateDto,
        version: 1,
      });

      const result = await service.update(userId, updateDto);

      expect(result.name).toBe("Updated Name");
      expect(result.version).toBe(1);
      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(
        userId,
        ["address"],
        mockEntityManager,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Name", version: 1 }),
        mockEntityManager,
      );

      // Verifica se o endereço foi atualizado
      expect(mockEntityManager.save).toHaveBeenCalledWith(
        UserAddress,
        expect.objectContaining({ zipCode: "54321", version: 1 }),
      );

      // Verifica se os attachments foram removidos
      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager,
        AttachmentOwnerType.USER,
        userId,
      );
      // Verifica se tentou criar novos (mesmo com array vazio)
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).not.toHaveBeenCalled();
    });

    it("should throw ConflictException if new email is already in use", async () => {
      const dtoWithEmail = { ...updateDto, email: "another@example.com" };
      const userWithOldEmail = { ...mockUserFound, email: "test@example.com" };

      mockUserRepository.findById.mockResolvedValue(userWithOldEmail);
      mockUserRepository.verifyUserExists.mockResolvedValue(true); // Email já existe

      await expect(service.update(userId, dtoWithEmail)).rejects.toThrow(
        ConflictException,
      );

      expect(mockUserRepository.verifyUserExists).toHaveBeenCalledWith(
        "another@example.com",
        mockEntityManager,
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("updatePassword", () => {
    const dto: UpdatePasswordDto = {
      user_id: 1,
      password: "NewPassword123!",
      version: 0,
    };

    it("should update password successfully", async () => {
      const mockUserFound = { ...mockUser, version: 0 };
      mockUserRepository.findById.mockResolvedValue(mockUserFound);

      const result = await service.updatePassword(dto);

      expect(result).toEqual({ success: "Password updated successfully" });
      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(
        dto.user_id,
        [],
        mockEntityManager,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          passwordHash: "hashed_password",
        }),
        mockEntityManager,
      );
    });

    it("should throw BadRequestException on version mismatch", async () => {
      const mockUserFound = { ...mockUser, version: 1 }; // Versão do DB é 1
      const dtoWithOldVersion = { ...dto, version: 0 }; // DTO envia versão 0

      mockUserRepository.findById.mockResolvedValue(mockUserFound);

      await expect(service.updatePassword(dtoWithOldVersion)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("markEmailVerified", () => {
    it("should mark email as verified", async () => {
      const userId = 1;
      const mockUserFound = { ...mockUser, emailVerified: false };
      mockUserRepository.findById.mockResolvedValue(mockUserFound);

      await service.markEmailVerified(userId);

      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(
        userId,
        [],
        mockEntityManager,
      );
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true }),
        mockEntityManager,
      );
    });
  });

  describe("Pass-through methods (findAll, findById, findByEmail, deleteUser, getUserStats)", () => {
    it("findAll: should call repo.findAll", async () => {
      const filterDto: UserFilterDTO = { limit: 10, skip: 0 };
      const response: PaginationResponse<User> = {
        data: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
      };
      mockUserRepository.findAll.mockResolvedValue(response);

      const result = await service.findAll(filterDto);

      expect(result).toEqual(response);
      expect(mockUserRepository.findAll).toHaveBeenCalledWith(filterDto);
    });

    it("findById: should call repo.findById", async () => {
      const id = 1;
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findById(id);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(id, [
        "address",
        "attachments",
        "subscriptions",
      ]);
    });

    it("findByEmail: should call repo.findByEmail", async () => {
      const email = "test@example.com";
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await service.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email, [
        "address",
        "attachments",
        "subscriptions",
      ]);
    });

    it("deleteUser: should find user, log, and call repo.delete", async () => {
      const id = 1;
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await service.deleteUser(id);

      expect(mockTxManagerService.run).toHaveBeenCalled();
      expect(mockUserRepository.findById).toHaveBeenCalledWith(
        id,
        [],
        mockEntityManager,
      );
      expect(mockLogService.logDelete).toHaveBeenCalledWith(
        mockEntityManager,
        id,
        "User",
        mockUser,
      );
      expect(mockUserRepository.delete).toHaveBeenCalledWith(
        id,
        mockEntityManager,
      );
    });

    it("getUserStats: should call repo.getUserStats", async () => {
      const stats = { total: 10, individual: 5, company: 5 };
      mockUserRepository.getUserStats.mockResolvedValue(stats);

      const result = await service.getUserStats();

      expect(result).toEqual(stats);
      expect(mockUserRepository.getUserStats).toHaveBeenCalled();
    });
  });
});
