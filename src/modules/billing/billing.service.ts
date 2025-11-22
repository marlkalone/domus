import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { CreateBillingDTO } from "./dto/create-billing.dto";
import { ReadBillingDTO } from "./dto/read-billing.dto";
import { UpdateBillingDTO } from "./dto/update-billing.dto";
import { DeleteBillingDTO } from "./dto/delete-billing.dto";
import { BillingRepository } from "./repository/billing.repository";
import { Billing } from "../../infra/database/entities/billing.entity";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { Project } from "../../infra/database/entities/project.entity";
import {
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../common/enums/transaction.enum";
import { TransactionService } from "../transaction/transaction.service";
import { BillingStatus } from "../../common/enums/billing.enum";
import { ProjectService } from "../project/project.service";
import { BillingFilterDTO } from "./dto/billing-filter.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { LogService } from "../log/log.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly billingRepo: BillingRepository,
    private readonly txService: TransactionService,
    private readonly projectService: ProjectService,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateBillingDTO): Promise<Billing> {
    return this.txManager.run(async (manager: EntityManager) => {
      const project = await manager.findOne(Project, {
        where: { id: dto.projectId, user: { id: userId } },
      });

      if (!project) {
        throw new NotFoundException(`Project #${dto.projectId} not found`);
      }

      const bill = manager.create(Billing, {
        ...dto,
        billingDate: new Date(dto.billingDate),
        version: 0,
        project: { id: dto.projectId },
      });

      const savedBill = manager.save(bill);

      await this.logService.logCreate(manager, userId, "Billing", savedBill);

      return savedBill;
    });
  }

  async read(
    userId: number,
    dto: ReadBillingDTO,
  ): Promise<Billing | Billing[]> {
    if (dto.billingId != null) {
      const bill = await this.billingRepo.findOneByIds(
        userId,
        dto.projectId,
        dto.billingId,
      );

      if (!bill) {
        throw new NotFoundException(`Billing #${dto.billingId} not found`);
      }

      return bill;
    }

    throw new BadRequestException("Use the paginated endpoint with filters");
  }

  async findAll(
    userId: number,
    filter: BillingFilterDTO,
  ): Promise<PaginationResponse<Billing>> {
    const { skip, limit } = filter;

    const project = await this.projectService.findOne(userId, filter.projectId);

    if (!project) {
      throw new NotFoundException(`Project #${filter.projectId} not found`);
    }

    const [data, total] = await this.billingRepo.findAll(userId, filter);

    return {
      data,
      total,
      page: skip / limit + 1,
      limit,
    };
  }

  async update(userId: number, dto: UpdateBillingDTO): Promise<Billing> {
    return this.txManager.run(async (manager: EntityManager) => {
      const repo = manager.getRepository(Billing);

      const existing = await repo.findOne({
        where: { id: dto.id },
        relations: ["project", "project.user"],
      });

      if (!existing || existing.project.user.id !== userId) {
        throw new NotFoundException(`Billing #${dto.id} not found`);
      }
      if (existing.version !== dto.version) {
        throw new ConflictException("Version mismatch");
      }

      await this.logService.logUpdate(
        manager,
        userId,
        "Billing",
        existing,
        dto,
      );

      existing.billingDate = dto.billingDate
        ? new Date(dto.billingDate)
        : existing.billingDate;
      existing.amount = dto.amount ?? existing.amount;
      existing.version += 1;

      return repo.save(existing);
    });
  }

  async remove(userId: number, dto: DeleteBillingDTO): Promise<void> {
    return this.txManager.run(async (manager: EntityManager) => {
      const repo = manager.getRepository(Billing);

      const existing = await repo.findOne({
        where: {
          id: dto.id,
          project: { id: dto.projectId },
        },
        relations: ["project", "project.user"],
      });

      if (!existing || existing.project.user.id !== userId) {
        throw new NotFoundException(`Billing #${dto.id} not found`);
      }

      await this.logService.logDelete(manager, userId, "Billing", existing);

      await repo.remove(existing);
    });
  }

  async markAsPaid(
    userId: number,
    billingId: number,
    paymentDate: Date,
  ): Promise<Billing> {
    return this.txManager.run(async (manager: EntityManager) => {
      const billingRepo = manager.getRepository(Billing);

      const bill = await billingRepo.findOne({
        where: { id: billingId, project: { user: { id: userId } } },
        relations: ["project", "contact"],
      });

      if (!bill) {
        throw new NotFoundException(`Billing #${billingId} not found`);
      }

      if (bill.status === BillingStatus.PAID) {
        throw new ConflictException("This bill has already been paid.");
      }

      bill.status = BillingStatus.PAID;
      bill.paymentDate = paymentDate || new Date();
      await billingRepo.save(bill);

      await this.txService.create(userId, {
        title: bill.description,
        type: TransactionType.EXPENSE,
        category: "FROM_BILLING",
        recurrence: PeriodicityType.ONE_TIME,
        amount: bill.amount,
        startDate: bill.paymentDate,
        paymentDate: bill.paymentDate,
        status: TransactionStatus.INVOICED,
        projectId: bill.project.id,
        contactId: bill.contact?.id,
      });

      return bill;
    });
  }
}
