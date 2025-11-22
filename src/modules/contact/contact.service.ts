import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { AttachmentService } from "../attachment/attachment.service";
import { AttachmentOwnerType } from "../../common/enums/subscription.enum";
import { ContactRepository } from "./repository/contact.repository";
import { ContactDetailRepository } from "./repository/contact-detail.repository";
import { Contact } from "../../infra/database/entities/contact.entity";
import { CreateContactDTO } from "./dto/create-contact.dto";
import { ContactDetail } from "../../infra/database/entities/contactDetail.entity";
import { UpdateContactDTO } from "./dto/update-contact.dto";
import { isContactDetailValid } from "../../common/utils/contact.utils";
import { ContactFilterDTO } from "./dto/contact-filter.dto";
import { ContactRole } from "../../common/enums/contact.enums";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { LogService } from "../log/log.service";

@Injectable()
export class ContactService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly contactRepo: ContactRepository,
    private readonly detailRepo: ContactDetailRepository,
    private readonly attachmentService: AttachmentService,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateContactDTO): Promise<Contact> {
    return this.txManager.run(async (manager: EntityManager) => {
      // 1) contact
      const contact = manager.create(Contact, {
        role: dto.role,
        contactType: dto.contactType,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        version: 0,
        user: { id: userId },
      });

      const saved = await this.contactRepo.save(contact, manager);

      // 2) details
      if (dto.details?.length) {
        const valid = dto.details.filter(isContactDetailValid);
        const details = valid.map((d) =>
          manager.create(ContactDetail, {
            key: d.key,
            value: d.value,
            contact: { id: saved.id },
          }),
        );

        await this.detailRepo.save(details, manager);
      }

      // 3) attachments
      if (dto.attachmentKeys?.length) {
        await this.attachmentService.createRecordsWithManager(
          manager,
          AttachmentOwnerType.CONTACT,
          saved.id,
          dto.attachmentKeys,
        );
      }

      const createdContact = await this.contactRepo.findOneByIdAndUser(
        saved.id,
        userId,
        manager,
      );

      if (!createdContact)
        throw new InternalServerErrorException(
          "Failed to find created contact",
        );

      await this.logService.logCreate(
        manager,
        userId,
        "Contact",
        createdContact,
      );

      return createdContact;
    });
  }

  async findOne(
    userId: number,
    contactId: number,
    manager?: EntityManager,
  ): Promise<Contact> {
    const contact = await this.contactRepo.findOneByIdAndUser(
      contactId,
      userId,
      manager,
    );
    if (!contact)
      throw new NotFoundException(`Contact #${contactId} not found`);
    return contact;
  }

  async findByUserAndRole(
    userId: number,
    role: ContactRole,
    manager?: EntityManager,
  ): Promise<Contact[]> {
    return this.contactRepo.findByUserAndRole(userId, role, manager);
  }

  async listContacts(
    userId: number,
    filter: ContactFilterDTO,
  ): Promise<PaginationResponse<Contact>> {
    if (filter.state && filter.state.length > 2) {
      throw new BadRequestException(
        "State filter deve ser abreviação de 2 caracteres",
      );
    }

    const { items, total } = await this.contactRepo.findFilteredPaginated(
      userId,
      filter,
    );

    return {
      data: items,
      total,
      page: (filter.skip ?? 0) / (filter.limit ?? 10) + 1,
      limit: filter.limit ?? 10,
    };
  }

  async update(userId: number, dto: UpdateContactDTO): Promise<Contact> {
    return this.txManager.run(async (manager: EntityManager) => {
      const existing = await this.contactRepo.findOneByIdAndUser(
        dto.id,
        userId,
        manager,
      );

      if (!existing) {
        throw new NotFoundException(`Contact #${dto.id} not found`);
      }

      if (existing.version !== dto.version)
        throw new BadRequestException("Version mismatch");

      await this.logService.logUpdate(
        manager,
        userId,
        "Contact",
        existing,
        dto,
      );

      // 1) core fields
      existing.role = dto.role;
      existing.contactType = dto.contactType;
      existing.name = dto.name;
      existing.email = dto.email;
      existing.phone = dto.phone;
      existing.version += 1;
      await this.contactRepo.save(existing, manager);

      // 2) details
      await this.detailRepo.deleteByContact(existing.id, manager);
      if (dto.details?.length) {
        const valid = dto.details.filter(isContactDetailValid);
        const newDetails = valid.map((d) =>
          manager.create(ContactDetail, {
            key: d.key,
            value: d.value,
            contact: existing,
          }),
        );

        await this.detailRepo.save(newDetails, manager);
      }

      // 3) attachments
      if (dto.attachmentKeys) {
        await this.attachmentService.removeAllForOwnerWithManager(
          manager,
          AttachmentOwnerType.CONTACT,
          existing.id,
        );
        if (dto.attachmentKeys.length > 0) {
          await this.attachmentService.createRecordsWithManager(
            manager,
            AttachmentOwnerType.CONTACT,
            existing.id,
            dto.attachmentKeys,
          );
        }
      }

      const updatedContact = await this.contactRepo.findOneByIdAndUser(
        existing.id,
        userId,
        manager,
      );

      if (!updatedContact)
        throw new InternalServerErrorException(
          "Failed to find updated contact",
        );

      return updatedContact;
    });
  }

  async remove(userId: number, contactId: number): Promise<void> {
    return this.txManager.run(async (manager: EntityManager) => {
      const contact = await this.contactRepo.findOneByIdAndUser(
        contactId,
        userId,
        manager,
      );

      if (!contact)
        throw new NotFoundException(`Contact #${contactId} not found`);

      await this.logService.logDelete(manager, userId, "Contact", contact);

      await this.attachmentService.removeAllForOwnerWithManager(
        manager,
        AttachmentOwnerType.CONTACT,
        contact.id,
      );

      await this.contactRepo.remove(contact, manager);
    });
  }
}
