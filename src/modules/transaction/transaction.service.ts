import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { TransactionRepository } from "./repository/transaction.repository";
import { AttachmentService } from "../attachment/attachment.service";
import { TaxService } from "../tax/tax.service";
import { RecurrenceSplitter } from "./helpers/recurrence-spliter";
import { PeriodValidator } from "./helpers/period-validator";
import { Transaction } from "../../infra/database/entities/transaction.entity";
import { AttachmentOwnerType } from "../../common/enums/subscription.enum";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import { DeleteTaxAssociationDto } from "./dto/delete-tax-association.dto";
import {
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../common/enums/transaction.enum";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { TransactionHistoryEntryDTO } from "./dto/transaction-history.dto";
import { UpcomingExpenseDTO } from "./dto/upcoming-expense.dto";
import { ProjectStatus } from "../../common/enums/project.enum";
import { EntityManager } from "typeorm";
import { DeleteTransactionDTO } from "./dto/delete-transaction.dto";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { ProjectService } from "../project/project.service";
import { ContactService } from "../contact/contact.service";
import { TransactionFilterQueryDto } from "./dto/transaction-filter-query.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { UpdateScope } from "./dto/update-scope.enum";
import { LogService } from "../log/log.service";

@Injectable()
export class TransactionService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly txRepo: TransactionRepository,
    private readonly contactService: ContactService,
    private readonly attachSvc: AttachmentService,
    private readonly projectService: ProjectService,
    private readonly taxSvc: TaxService,
    private readonly splitter: RecurrenceSplitter,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateTransactionDTO) {
    const project = await this.projectService.findOne(userId, dto.projectId);
    if (!project) throw new NotFoundException("Project not found");

    const contact = await this.contactService.findOne(userId, dto.contactId);
    if (!contact) throw new NotFoundException("Contact not found");

    const start = new Date(dto.startDate);
    const end = dto.endDate ? new Date(dto.endDate) : undefined;
    PeriodValidator.validateDates(dto.type, start, end);

    return this.txManager.run(async (manager: EntityManager) => {
      // 3) Divide recorrências
      const segments = this.splitter.split(start, end ?? start, dto.recurrence);

      let firstRecord: Transaction | null = null;

      for (let i = 0; i < segments.length; i++) {
        const parentId = firstRecord ? firstRecord.id : undefined;

        const record = await this.txRepo.createWithManager(manager, {
          title: dto.title,
          category: dto.category,
          type: dto.type,
          recurrence: dto.recurrence,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          amount: dto.amount,
          status: dto.status,
          expenseType: dto.expenseType,
          version: 0,
          projectId: dto.projectId,
          contactId: dto.contactId,
          startDate: segments[i].start,
          endDate: segments[i].end,
          parentId: parentId,
        });

        if (i === 0) {
          firstRecord = record;
        }

        // 5) Orquestra outros serviços, passando o manager
        if (dto.taxIds) {
          await this.taxSvc.attachToTransactionWithManager(
            manager,
            record.id, // Usa o ID do registro atual
            dto.taxIds,
          );
        }
        if (dto.attachmentKeys?.length) {
          await this.attachSvc.createRecordsWithManager(
            manager,
            AttachmentOwnerType.TRANSACTION,
            record.id, // Usa o ID do registro atual
            dto.attachmentKeys,
          );
        }
      }

      if (!firstRecord) {
        throw new InternalServerErrorException(
          "Failed to create initial transaction record.",
        );
      }

      // 6) Retorna o primeiro registro criado
      const result = await this.txRepo.findOneWithManager(
        manager,
        userId,
        dto.projectId,
        firstRecord.id,
      );

      if (!result) {
        throw new NotFoundException(
          `Failed to retrieve created transaction with ID ${firstRecord.id}`,
        );
      }

      await this.logService.logCreate(manager, userId, "Transaction", result);

      return result;
    });
  }

  async createSaleTransaction(
    userId: number,
    projectId: number,
    salePrice: number,
    contactId: number,
    saleDate: Date,
  ) {
    const project = await this.projectService.findOne(userId, projectId);

    await this.contactService.findOne(contactId, userId);

    // 2. Executa a orquestração (Project + Transaction) dentro da transação
    return this.txManager.run(async (manager: EntityManager) => {
      // 3. Atualiza o Projeto
      project.actualSalePrice = salePrice;
      project.status = ProjectStatus.SOLD;
      project.version += 1;
      // (Assume que 'saveWithManager' existe no ProjectRepository)
      await this.projectService.saveWithManager(manager, project);

      // 4. Cria a Transação de Venda
      const saleTxData = {
        title: `Venda do Projeto: ${project.title}`,
        type: TransactionType.REVENUE,
        category: "PROJECT_SALE",
        recurrence: PeriodicityType.ONE_TIME,
        startDate: saleDate,
        paymentDate: saleDate,
        amount: salePrice,
        status: TransactionStatus.INVOICED,
        version: 0,
        projectId: projectId, // Passa os IDs para o createWithManager
        contactId: contactId,
      };

      const result = await this.txRepo.createWithManager(manager, saleTxData);

      if (!result) {
        throw new InternalServerErrorException(
          "Failed to create sale transaction record.",
        );
      }
      // -----------------------------------------------------------
      return result;
    });
  }

  async update(dto: UpdateTransactionDto): Promise<Transaction> {
    const { userId, projectId, id, version, scope, taxIds, attachmentKeys } =
      dto;

    return this.txManager.run(async (manager: EntityManager) => {
      // 1. Busca a transação clicada (tx) DENTRO da transação
      const tx = await this.txRepo.findOneWithManager(
        manager,
        userId,
        projectId,
        id,
      );
      if (!tx) throw new NotFoundException(`Transaction #${id} not found`);

      // 2. Lógica de verificação de concorrência
      if (scope === UpdateScope.ONE) {
        // Se for SÓ UMA, verifica a versão da própria 'tx'
        if (tx.version !== version) {
          throw new ConflictException(
            `Version mismatch for transaction #${id}. Please refresh.`,
          );
        }
      } else if (scope === UpdateScope.ALL) {
        // Se for TODAS, busca a raiz e verifica a 'rootVersion'
        if (dto.rootVersion === null || dto.rootVersion === undefined) {
          throw new BadRequestException(
            "A rootVersion (versão da transação raiz) é necessária para atualizações com scope=ALL",
          );
        }

        const rootTx = await this.getRootTransaction(manager, tx);

        if (rootTx.version !== dto.rootVersion) {
          throw new ConflictException(
            `A série de transações foi modificada por outro usuário. Por favor, atualize a página.`,
          );
        }
      }

      // 3. Busca todas as transações a serem atualizadas
      const transactionsToUpdate = await this.findTransactionsByScope(
        manager,
        tx,
        scope,
      );

      for (const transaction of transactionsToUpdate) {
        // ... (lógica de atualização de campos)
        transaction.title = dto.title;
        transaction.category = dto.category;
        // ...
        transaction.expenseType = dto.expenseType;

        // A versão de CADA item da série deve ser incrementada
        transaction.version = transaction.version + 1;

        if (scope === UpdateScope.ONE) {
          // Só atualiza datas se for 'ONE'
          transaction.startDate = new Date(dto.startDate);
          transaction.endDate = dto.endDate ? new Date(dto.endDate) : undefined;
        }

        await this.txRepo.saveWithManager(manager, transaction);

        // ... (lógica de sincronia de taxas e anexos)
        if (taxIds) {
          // Só sincroniza se o array foi fornecido
          await this.taxSvc.detachFromTransactionWithManager(
            manager,
            transaction.id,
          );
          if (taxIds.length > 0) {
            await this.taxSvc.attachToTransactionWithManager(
              manager,
              transaction.id,
              taxIds,
            );
          }
        }
        if (attachmentKeys) {
          // Só sincroniza se o array foi fornecido
          await this.attachSvc.removeAllForOwnerWithManager(
            manager,
            AttachmentOwnerType.TRANSACTION,
            transaction.id,
          );
          if (attachmentKeys.length > 0) {
            await this.attachSvc.createRecordsWithManager(
              manager,
              AttachmentOwnerType.TRANSACTION,
              transaction.id,
              attachmentKeys,
            );
          }
        }
      }

      // 6. Retorna a transação original
      const result = await this.txRepo.findOneWithManager(
        manager,
        userId,
        projectId,
        id,
      );

      if (!result) {
        throw new NotFoundException(
          `Transaction #${id} not found after update.`,
        );
      }
      return result;
    });
  }

  async delete(dto: DeleteTransactionDTO): Promise<void> {
    const tx = await this.txRepo.findOne(dto.userId, dto.projectId, dto.id);
    if (!tx) throw new NotFoundException("Transaction not found");

    return this.txManager.run(async (manager: EntityManager) => {
      const transactionsToDelete = await this.findTransactionsByScope(
        manager,
        tx,
        dto.scope,
      );

      for (const transaction of transactionsToDelete) {
        await this.logService.logDelete(
          manager,
          dto.userId,
          "Transaction",
          transaction,
        );

        // 4a. Orquestra os deletes de entidades relacionadas
        await this.attachSvc.removeAllForOwnerWithManager(
          manager,
          AttachmentOwnerType.TRANSACTION,
          transaction.id,
        );
        await this.taxSvc.detachFromTransactionWithManager(
          manager,
          transaction.id,
        );

        // 4b. Executa o delete principal
        await this.txRepo.deleteWithManager(manager, transaction);
      }
    });
  }

  private async findTransactionsByScope(
    manager: EntityManager,
    tx: Transaction,
    scope: UpdateScope,
  ): Promise<Transaction[]> {
    if (scope === UpdateScope.ONE) {
      return [tx];
    }

    if (scope === UpdateScope.ALL) {
      // 1. Recarrega a transação com sua relação 'parent' para encontrar o ID raiz
      const txWithParent = await manager.findOne(Transaction, {
        where: { id: tx.id },
        relations: ["parent"], // Carrega a relação 'parent'
      });

      if (!txWithParent) return [tx]; // Failsafe

      // 2. Determina o ID da transação "raiz"
      // mostra que a relação se chama 'parent'
      const rootId = txWithParent.parent ? txWithParent.parent.id : tx.id;

      // 3. Encontra a raiz (pelo id) E todas as filhas (pelo parent.id)
      const transactions = await manager.find(Transaction, {
        where: [
          { id: rootId }, // A própria transação raiz
          { parent: { id: rootId } }, // Todas as filhas que apontam para a raiz
        ],
      });

      if (transactions.length > 0) {
        return transactions;
      }
    }

    return [tx];
  }

  private async getRootTransaction(
    manager: EntityManager,
    tx: Transaction,
  ): Promise<Transaction> {
    // Se a 'tx' atual não tiver 'parentId', ela é a raiz.
    // A entidade 'tx' vinda de findOneWithManager não carrega 'parent'

    const txWithParent = await manager.findOne(Transaction, {
      where: { id: tx.id },
      relations: ["parent"], // Carrega a relação 'parent'
    });

    if (!txWithParent) return tx;

    if (txWithParent.parent) {
      // Se tem pai, busca o pai (que é a raiz)
      const root = await manager.findOne(Transaction, {
        where: { id: txWithParent.parent.id },
      });
      if (root) return root;
    }

    // Se não tem pai, ela mesma é a raiz
    return txWithParent;
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (NÃO TRANSACIONAIS)
  // ===================================================================

  async readOne(userId: number, projectId: number, transactionId: number) {
    const tx = await this.txRepo.findOne(userId, projectId, transactionId);
    if (!tx) throw new NotFoundException("Transaction not found");
    return tx;
  }

  async findAll(
    userId: number,
    filter: TransactionFilterQueryDto,
  ): Promise<PaginationResponse<Transaction>> {
    const { skip = 0, limit = 10, projectId = null, ...opts } = filter;

    const { items, total } = await this.txRepo.findFilteredPaginated(
      userId,
      projectId,
      opts,
      skip,
      limit,
    );

    return {
      data: items,
      total: total,
      limit: limit,
      page: skip / limit + 1,
    };
  }

  async getTotalsByYear(
    userId: number,
    projectId: number | null,
    year: number,
  ): Promise<{ revenue: string; expense: string }> {
    return await this.txRepo.getTotalsByYear(userId, projectId, year);
  }

  async sumExpensesForProject(projectId: number): Promise<number> {
    return await this.txRepo.sumExpensesForProject(projectId);
  }

  async sumExpensesByProjectStatus(
    userId: number,
  ): Promise<{ status: ProjectStatus; total: string }[]> {
    return this.txRepo.sumExpensesByProjectStatus(userId);
  }

  //Busca dados para o dashboard (histórico e despesas futuras).
  async getDashboardTransactions(userId: number) {
    const raw = await this.txRepo.getHistoryLast12Months(userId);
    const historyLast12Months: TransactionHistoryEntryDTO[] = raw.map((r) => ({
      month: r.month,
      revenue: parseFloat(r.revenue), // Representa Vendas
      expense: parseFloat(r.expense), // Representa Custos de Obra
    }));

    const upcoming = await this.txRepo.findUpcomingOpenExpenses(userId, 5);
    const upcomingOpenExpenses: UpcomingExpenseDTO[] = upcoming.map((tx) => ({
      id: tx.id,
      title: tx.title,
      amount: Number(tx.amount),
      dueDate: tx.startDate,
      projectId: tx.project.id,
      projectTitle: tx.project.title,
    }));

    return { historyLast12Months, upcomingOpenExpenses };
  }

  async getPortfolioSummaryByYear(
    userId: number,
    year: number,
  ): Promise<{ revenue: string; expense: string; net: string }> {
    return this.txRepo.getPortfolioSummaryByYear(userId, year);
  }

  async deleteTaxAssociation(dto: DeleteTaxAssociationDto) {
    await this.taxSvc.detachOne(dto.transactionId, dto.taxId);
  }
}
