import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { User } from "../../../infra/database/entities/user.entity";
import { Contact } from "../../../infra/database/entities/contact.entity";
import {
  ContactDetailKey,
  ContactRole,
  ContactType,
} from "../../../common/enums/contact.enums";
import { ContactDetail } from "../../../infra/database/entities/contactDetail.entity";
import { ContactService } from "../contact.service";
import { ContactRepository } from "../repository/contact.repository";
import { ContactDetailRepository } from "../repository/contact-detail.repository";
import { AttachmentService } from "../../attachment/attachment.service";
import { LogService } from "../../log/log.service";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { CreateContactDTO } from "../dto/create-contact.dto";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { ContactFilterDTO } from "../dto/contact-filter.dto";
import { PaginationResponse } from "../../../common/utils/pagination-response";
import { UpdateContactDTO } from "../dto/update-contact.dto";

const mockEntityManager = {
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
};

describe("ContactService", () => {
  let service: ContactService;
  let mockContactRepo: any;
  let mockDetailRepo: any;
  let mockAttachmentService: any;
  let mockLogService: any;
  let mockTxManager: any;

  const mockUser: User = { id: 1 } as any;
  const mockContact: Contact = {
    id: 1,
    name: "Test Contact",
    role: ContactRole.PROVIDER,
    contactType: ContactType.INDIVIDUAL,
    email: "test@contact.com",
    phone: "123456789",
    version: 0,
    user: mockUser,
    details: [],
    attachments: [],
  } as any;

  const mockDetail: ContactDetail = {
    id: 1,
    key: ContactDetailKey.NOTES,
    value: "A note",
    contact: mockContact,
  } as any;

  beforeEach(async () => {
    mockContactRepo = {
      save: jest.fn(),
      findOneByIdAndUser: jest.fn(),
      findFilteredPaginated: jest.fn(),
      remove: jest.fn(),
      findByUserAndRole: jest.fn(),
    };
    mockDetailRepo = {
      deleteByContact: jest.fn(),
      save: jest.fn(),
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

    mockEntityManager.create.mockClear();
    mockEntityManager.save.mockClear();
    mockEntityManager.remove.mockClear();
    mockEntityManager.findOne.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: ContactRepository, useValue: mockContactRepo },
        { provide: ContactDetailRepository, useValue: mockDetailRepo },
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: LogService, useValue: mockLogService },
        { provide: TransactionManagerService, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const userId = 1;
    const createDto: CreateContactDTO = {
      role: ContactRole.COLLABORATOR,
      contactType: ContactType.INDIVIDUAL,
      name: "New Contact",
      email: "new@contact.com",
      phone: "987654321",
      details: [
        { key: ContactDetailKey.NOTES, value: "Test note" },
        { key: ContactDetailKey.CITY, value: "Test City" },
      ],
      attachmentKeys: [
        { key: "key1", originalName: "doc.pdf", mimeType: "app/pdf" },
      ],
    };

    it("should create a contact with details and attachments", async () => {
      const savedContact = { ...createDto, id: 2, user: { id: userId } };

      mockEntityManager.create.mockImplementation((entity, data) => data);
      mockContactRepo.save.mockResolvedValue(savedContact);
      mockDetailRepo.save.mockResolvedValue([]);
      mockAttachmentService.createRecordsWithManager.mockResolvedValue([]);
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(savedContact);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(savedContact);
      expect(mockTxManager.run).toHaveBeenCalled();

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Contact,
        expect.objectContaining({ name: "New Contact" }),
      );
      expect(mockContactRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Contact" }),
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        ContactDetail,
        expect.objectContaining({ key: ContactDetailKey.NOTES }),
      );
      expect(mockDetailRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: ContactDetailKey.NOTES }),
          expect.objectContaining({ key: ContactDetailKey.CITY }),
        ]),
        mockEntityManager as unknown as EntityManager,
      );

      expect(
        mockAttachmentService.createRecordsWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.CONTACT,
        savedContact.id,
        createDto.attachmentKeys,
      );

      expect(mockLogService.logCreate).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return a contact if found", async () => {
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(mockContact);

      const result = await service.findOne(1, 1);

      expect(result).toEqual(mockContact);
      expect(mockContactRepo.findOneByIdAndUser).toHaveBeenCalledWith(
        1,
        1,
        undefined,
      );
    });

    it("should throw NotFoundException if contact not found", async () => {
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.findOne(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe("listContacts", () => {
    it("should return paginated contacts", async () => {
      const filter: ContactFilterDTO = { skip: 0, limit: 10 };
      const responseData = { items: [mockContact], total: 1 };
      mockContactRepo.findFilteredPaginated.mockResolvedValue(responseData);

      const result = await service.listContacts(1, filter);

      const expectedResponse: PaginationResponse<Contact> = {
        data: [mockContact],
        total: 1,
        page: 1,
        limit: 10,
      };

      expect(result).toEqual(expectedResponse);
    });

    it("should throw BadRequestException for invalid state filter", async () => {
      const filter: ContactFilterDTO = { state: "TooLong" } as any;

      await expect(service.listContacts(1, filter)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockContactRepo.findFilteredPaginated).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const userId = 1;
    const updateDto: UpdateContactDTO = {
      id: 1,
      version: 0,
      role: ContactRole.TENANT,
      name: "Updated Name",
      email: "updated@contact.com",
      phone: "111111111",
      details: [{ key: ContactDetailKey.NOTES, value: "New note" }], // Substitui
      attachmentKeys: [], // Remove todos
    };

    let testMockContact: Contact;

    beforeEach(() => {
      testMockContact = JSON.parse(JSON.stringify(mockContact));
      testMockContact.details = [JSON.parse(JSON.stringify(mockDetail))];
    });

    it("should update contact, wipe/reinsert details, and sync attachments", async () => {
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(testMockContact);
      mockContactRepo.save.mockResolvedValue(true);
      mockDetailRepo.deleteByContact.mockResolvedValue();
      mockDetailRepo.save.mockResolvedValue([]);
      mockAttachmentService.removeAllForOwnerWithManager.mockResolvedValue();
      // Mock da chamada final
      mockContactRepo.findOneByIdAndUser
        .mockResolvedValueOnce(testMockContact)
        .mockResolvedValueOnce({
          ...testMockContact,
          ...updateDto,
          version: 1,
        });

      const result = await service.update(userId, updateDto);

      expect(result.name).toBe("Updated Name");
      expect(result.version).toBe(1);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockContactRepo.findOneByIdAndUser).toHaveBeenCalledWith(
        updateDto.id,
        userId,
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();

      expect(mockContactRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Name", version: 1 }),
        mockEntityManager as unknown as EntityManager,
      );

      expect(mockDetailRepo.deleteByContact).toHaveBeenCalledWith(
        testMockContact.id,
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockDetailRepo.save).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            key: ContactDetailKey.NOTES,
            value: "New note",
          }),
        ],
        mockEntityManager as unknown as EntityManager,
      );

      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalled();
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if contact not found", async () => {
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.update(userId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException on version mismatch", async () => {
      const mismatchedDto = { ...updateDto, version: 1 };
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(testMockContact);

      await expect(service.update(userId, mismatchedDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("remove", () => {
    it("should remove a contact and its attachments", async () => {
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(mockContact);

      await service.remove(1, 1);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockContactRepo.findOneByIdAndUser).toHaveBeenCalledWith(
        1,
        1,
        mockEntityManager as unknown as EntityManager,
      );
      expect(mockLogService.logDelete).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        1,
        "Contact",
        mockContact,
      );
      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.CONTACT,
        mockContact.id,
      );
      expect(mockContactRepo.remove).toHaveBeenCalledWith(
        mockContact,
        mockEntityManager as unknown as EntityManager,
      );
    });

    it("should throw NotFoundException if contact not found on remove", async () => {
      mockContactRepo.findOneByIdAndUser.mockResolvedValue(null);

      await expect(service.remove(1, 99)).rejects.toThrow(NotFoundException);
    });
  });
});
