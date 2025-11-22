import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { CreateTaxDTO } from "./dto/create-tax.dto";
import { UpdateTaxDTO } from "./dto/update-tax.dto";
import { DeleteTaxDTO } from "./dto/delete-tax.dto";
import { TaxRepository } from "./repository/tax.repository";
import { Tax } from "../../infra/database/entities/tax.entity";
import { Transaction } from "../../infra/database/entities/transaction.entity";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { EntityManager } from "typeorm";
import { TaxFilterDTO } from "./dto/tax-filter.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { LogService } from "../log/log.service";

@Injectable()
export class TaxService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly repo: TaxRepository,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateTaxDTO): Promise<Tax> {
    return this.txManager.run(async (manager: EntityManager) => {
      const tax = this.repo.createEntity({
        user: { id: userId } as any,
        title: dto.title,
        taxType: dto.type,
        percentage: dto.percentage,
        version: 0,
      });

      const savedTax = await this.repo.saveWithManager(manager, tax);

      await this.logService.logCreate(manager, userId, "Tax", savedTax);

      return savedTax;
    });
  }

  async findOne(userId: number, id: number): Promise<Tax | Tax[]> {
    const tax = await this.repo.findOneByIdAndUser(id, userId);

    if (!tax) throw new NotFoundException(`Tax #${id} not found`);

    return tax;
  }

  async findAll(
    userId: number,
    filter: TaxFilterDTO,
  ): Promise<PaginationResponse<Tax>> {
    const { skip, limit } = filter;
    const [data, total] = await this.repo.findAll(userId, filter);

    return {
      data,
      total,
      page: skip / limit + 1,
      limit,
    };
  }

  async update(userId: number, dto: UpdateTaxDTO): Promise<Tax> {
    return this.txManager.run(async (manager) => {
      const existing = await this.repo.findOneByIdAndUserWithManager(
        manager,
        dto.id,
        userId,
      );

      if (!existing) throw new NotFoundException(`Tax #${dto.id} not found`);
      if (existing.version !== dto.version)
        throw new ConflictException("Version mismatch");

      await this.logService.logUpdate(manager, userId, "Tax", existing, dto);

      existing.title = dto.title ?? existing.title;
      existing.taxType = dto.type ?? existing.taxType;
      existing.percentage = dto.percentage ?? existing.percentage;
      existing.version += 1;

      return this.repo.saveWithManager(manager, existing);
    });
  }

  async remove(dto: DeleteTaxDTO): Promise<void> {
    return this.txManager.run(async (manager: EntityManager) => {
      const tax = await this.repo.findOneByIdAndUserWithManager(
        manager,
        dto.id,
        dto.user_id,
      );
      if (!tax) {
        throw new NotFoundException(`Tax #${dto.id} not found or not yours`);
      }

      await this.logService.logDelete(manager, dto.user_id, "Tax", tax);

      await this.detachFromAllTransactionsWithManager(manager, tax.id);

      await this.repo.removeWithManager(manager, tax);
    });
  }

  async attachToTransaction(
    transactionId: number,
    taxIds: number[],
  ): Promise<void> {
    return this.txManager.run(async (manager) => {
      return this.attachToTransactionWithManager(
        manager,
        transactionId,
        taxIds,
      );
    });
  }

  async attachToTransactionWithManager(
    manager: EntityManager,
    transactionId: number,
    taxIds: number[],
  ): Promise<void> {
    for (const tid of taxIds) {
      const tax = await this.repo.findOneByIdWithManager(manager, tid);
      if (!tax) throw new NotFoundException(`Tax #${tid} not found`);
    }

    await manager
      .getRepository(Transaction)
      .createQueryBuilder()
      .relation(Transaction, "taxes")
      .of(transactionId)
      .add(taxIds);
  }

  async detachFromTransaction(transactionId: number): Promise<void> {
    return this.txManager.run(async (manager) => {
      return this.detachFromTransactionWithManager(manager, transactionId);
    });
  }

  async detachFromTransactionWithManager(
    manager: EntityManager,
    transactionId: number,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);
    const tx = await txRepo.findOne({
      where: { id: transactionId },
      relations: ["taxes"],
    });
    if (tx?.taxes?.length) {
      const ids = tx.taxes.map((t) => t.id);
      await txRepo
        .createQueryBuilder()
        .relation(Transaction, "taxes")
        .of(transactionId)
        .remove(ids);
    }
  }

  async detachOne(transactionId: number, taxId: number): Promise<void> {
    return this.txManager.run(async (manager) => {
      return this.detachOneWithManager(manager, transactionId, taxId);
    });
  }

  async detachOneWithManager(
    manager: EntityManager,
    transactionId: number,
    taxId: number,
  ): Promise<void> {
    await manager
      .getRepository(Transaction)
      .createQueryBuilder()
      .relation(Transaction, "taxes")
      .of(transactionId)
      .remove([taxId]);
  }

  private async detachFromAllTransactionsWithManager(
    manager: EntityManager,
    taxId: number,
  ): Promise<void> {
    const tax = await this.repo.findOneByIdWithManager(manager, taxId, [
      "transactions",
    ]);

    if (tax && tax.transactions?.length > 0) {
      const transactionIds = tax.transactions.map((tx) => tx.id);
      // Remove a relação de todas as transações
      await manager
        .getRepository(Tax)
        .createQueryBuilder()
        .relation(Tax, "transactions")
        .of(taxId)
        .remove(transactionIds);
    }
  }
}
