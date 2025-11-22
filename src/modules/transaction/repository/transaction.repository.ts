import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Transaction } from "../../../infra/database/entities/transaction.entity";
import { DataSource, DeepPartial, EntityManager, Repository } from "typeorm";
import {
  ExpenseCategory,
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../../common/enums/transaction.enum";
import { subMonths } from "date-fns/subMonths";
import { startOfMonth } from "date-fns/startOfMonth";
import { endOfMonth } from "date-fns/endOfMonth";
import { ProjectStatus } from "../../../common/enums/project.enum";

type CreateTransactionData = {
  title: string;
  category: string;
  type: TransactionType;
  recurrence: PeriodicityType;
  paymentDate: Date;
  amount: number;
  status: TransactionStatus;
  expenseType?: ExpenseCategory;
  version: number;
  projectId: number;
  contactId: number;
  startDate: Date;
  endDate?: Date;
  parentId?: number;
};

@Injectable()
export class TransactionRepository {
  private readonly repo: Repository<Transaction>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Transaction);
  }

  // ===================================================================
  // MÉTODOS DE ESCRITA (TRANSACTION-AWARE)
  // Usados pelo TransactionService DENTRO de um 'txManager.run()'
  // ===================================================================

  async createWithManager(
    manager: EntityManager,
    dto: CreateTransactionData,
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    const entityData = {
      title: dto.title,
      category: dto.category,
      type: dto.type,
      recurrence: dto.recurrence,
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      amount: dto.amount,
      status: dto.status,
      expenseType: dto.expenseType,
      version: 0,
      ...(dto.projectId && { project: { id: dto.projectId } }),
      ...(dto.contactId && { contact: { id: dto.contactId } }),
      ...(dto.parentId && { parent: { id: dto.parentId } }),
    };

    const tx = repo.create(entityData as DeepPartial<Transaction>);
    return repo.save(tx);
  }

  async saveWithManager(
    manager: EntityManager,
    tx: Transaction,
  ): Promise<Transaction> {
    const repo = manager.getRepository(Transaction);
    return repo.save(tx);
  }

  async deleteWithManager(
    manager: EntityManager,
    tx: Transaction,
  ): Promise<void> {
    const repo = manager.getRepository(Transaction);
    await repo.remove(tx);
  }

  async findOneWithManager(
    manager: EntityManager,
    userId: number,
    projectId: number,
    transactionId: number,
  ): Promise<Transaction | null> {
    const repo = manager.getRepository(Transaction);
    return repo.findOne({
      where: {
        id: transactionId,
        project: { id: projectId, user: { id: userId } },
      },
      relations: ["project", "contact", "taxes", "attachments"],
    });
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (NÃO TRANSACIONAIS)
  // Usados para GET requests, validações, dashboards, etc.
  // ===================================================================

  findOne(
    userId: number,
    projectId: number,
    transactionId: number,
  ): Promise<Transaction | null> {
    return this.repo.findOne({
      where: {
        id: transactionId,
        project: { id: projectId, user: { id: userId } },
      },
      relations: ["project", "contact", "taxes", "attachments"],
    });
  }

  async findFiltered(
    userId: number,
    projectId: number,
    opts: { start?: string; end?: string; type?: TransactionType },
  ): Promise<Transaction[]> {
    const qb = this.repo
      .createQueryBuilder("tx")
      .innerJoin(
        "tx.project",
        "p",
        "p.id = :projectId AND p.user.id = :userId",
        {
          projectId,
          userId,
        },
      )
      .leftJoinAndSelect("tx.contact", "c")
      .leftJoinAndSelect("tx.taxes", "tax")
      .leftJoinAndSelect("tx.attachments", "att");

    if (opts.type) {
      qb.andWhere("tx.type = :type", { type: opts.type });
    }
    if (opts.start) {
      qb.andWhere("tx.startDate >= :start", { start: opts.start });
    }
    if (opts.end) {
      qb.andWhere("tx.startDate <= :end", { end: opts.end });
    }

    return qb.getMany();
  }

  async getHistoryLast12Months(
    userId: number,
  ): Promise<{ month: string; revenue: string; expense: string }[]> {
    const start = subMonths(startOfMonth(new Date()), 11);

    return this.repo
      .createQueryBuilder("tx")
      .select("to_char(tx.startDate, 'MM/YYYY')", "month")
      .addSelect(
        `SUM(CASE WHEN tx.type = :rev THEN tx.amount ELSE 0 END)`,
        "revenue", // Representa Vendas
      )
      .addSelect(
        `SUM(CASE WHEN tx.type = :exp THEN tx.amount ELSE 0 END)`,
        "expense", // Representa Custos de Obra
      )
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .where("tx.startDate >= :start", { start })
      .setParameters({
        rev: TransactionType.REVENUE,
        exp: TransactionType.EXPENSE,
      })
      .groupBy("month")
      .orderBy("month")
      .getRawMany();
  }

  async findUpcomingOpenExpenses(
    userId: number,
    limit = 5,
  ): Promise<Transaction[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.repo
      .createQueryBuilder("tx")
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .leftJoinAndSelect("tx.project", "proj")
      .where("tx.type = :exp", { exp: TransactionType.EXPENSE })
      .andWhere("tx.status != :paid", { paid: TransactionStatus.INVOICED })
      .andWhere("tx.startDate >= :today", { today })
      .orderBy("tx.startDate", "ASC")
      .limit(limit)
      .getMany();
  }

  async sumRevenueAndExpenseByUserInPeriod(
    userId: number,
    start: Date,
    end: Date,
  ): Promise<{ revenue: string; expense: string }> {
    const qb = this.repo
      .createQueryBuilder("tx")
      .select(
        `SUM(CASE WHEN tx.type = :rev THEN tx.amount ELSE 0 END)`,
        "revenue",
      )
      .addSelect(
        `SUM(CASE WHEN tx.type = :exp THEN tx.amount ELSE 0 END)`,
        "expense",
      )
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .where("tx.startDate BETWEEN :start AND :end", { start, end })
      .setParameters({
        rev: TransactionType.REVENUE,
        exp: TransactionType.EXPENSE,
      });

    const sum = qb.getRawOne();

    if (!sum) {
      throw new InternalServerErrorException("Failed to get sum!");
    }

    return sum;
  }

  //2) Total de receita e despesa no ano
  async getTotalsByYear(
    userId: number,
    projectId: number | null,
    year: number,
  ): Promise<{ revenue: string; expense: string }> {
    const start = startOfMonth(new Date(year, 0, 1));
    const end = endOfMonth(new Date(year, 11, 1));

    const qb = this.repo
      .createQueryBuilder("tx")
      .select(
        `SUM(CASE WHEN tx.type = :rev THEN tx.amount ELSE 0 END)`,
        "revenue",
      )
      .addSelect(
        `SUM(CASE WHEN tx.type = :exp THEN tx.amount ELSE 0 END)`,
        "expense",
      )
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .where("tx.startDate BETWEEN :start AND :end", { start, end })
      .setParameters({
        rev: TransactionType.REVENUE,
        exp: TransactionType.EXPENSE,
      });

    if (projectId !== null) {
      qb.andWhere("p.id = :projectId", { projectId });
    }

    const total = qb.getRawOne();

    if (!total) {
      throw new InternalServerErrorException("Failed to get total!");
    }

    return total;
  }

  //3) Despesas por categoria no ano
  async getExpensesByCategory(
    userId: number,
    projectId: number | null,
    year: number,
  ): Promise<{ category: ExpenseCategory; total: string }[]> {
    const start = startOfMonth(new Date(year, 0, 1));
    const end = endOfMonth(new Date(year, 11, 1));

    const qb = this.repo
      .createQueryBuilder("tx")
      .select("tx.expenseType", "category")
      .addSelect("SUM(tx.amount)", "total")
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .where("tx.type = :exp", { exp: TransactionType.EXPENSE })
      .andWhere("tx.startDate BETWEEN :start AND :end", { start, end })
      .groupBy("tx.expenseType")
      .orderBy("total", "DESC");

    if (projectId !== null) {
      qb.andWhere("p.id = :projectId", { projectId });
    }

    return qb.getRawMany();
  }

  //4) Carteira do ano: receita, despesa e lucro líquido (pode reutilizar getTotalsByYear)
  async getPortfolioSummaryByYear(
    userId: number,
    year: number,
  ): Promise<{ revenue: string; expense: string; net: string }> {
    const { revenue, expense } = await this.getTotalsByYear(userId, null, year);
    // net = revenue - expense
    const net = (parseFloat(revenue) - parseFloat(expense)).toFixed(2);
    return { revenue, expense, net };
  }

  //5) Gastos por categoria como % do total de despesas
  async getExpenseCategoryPercentages(
    userId: number,
    projectId: number | null,
    year: number,
  ): Promise<{ category: ExpenseCategory; total: string; pct: string }[]> {
    const expenses = await this.getExpensesByCategory(userId, projectId, year);
    const sumAll = expenses.reduce((sum, e) => sum + parseFloat(e.total), 0);
    if (sumAll === 0) {
      return expenses.map((e) => ({ ...e, pct: "0.00" }));
    }
    return expenses.map((e) => ({
      category: e.category,
      total: e.total,
      pct: ((parseFloat(e.total) / sumAll) * 100).toFixed(2),
    }));
  }

  //6) Categoria de maior e menor gasto
  async getMinMaxExpenseCategory(
    userId: number,
    projectId: number | null,
    year: number,
  ): Promise<{
    min: { category: ExpenseCategory; total: string } | null;
    max: { category: ExpenseCategory; total: string } | null;
  }> {
    const expenses = await this.getExpensesByCategory(userId, projectId, year);
    if (expenses.length === 0) {
      return { min: null, max: null };
    }
    return {
      max: expenses[0],
      min: expenses[expenses.length - 1],
    };
  }

  // 7) Lista paginada de transactions com filtros (type, periodicity, year)
  async findFilteredPaginated(
    userId: number,
    projectId: number | null,
    opts: {
      type?: TransactionType;
      recurrence?: PeriodicityType;
      year?: number;
    },
    skip: number,
    limit: number,
  ): Promise<{ items: Transaction[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder("tx")
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .leftJoinAndSelect("tx.contact", "c")
      .leftJoinAndSelect("tx.taxes", "tax")
      .leftJoinAndSelect("tx.attachments", "att");

    if (projectId !== null) {
      qb.andWhere("p.id = :projectId", { projectId });
    }
    if (opts.type) {
      qb.andWhere("tx.type = :type", { type: opts.type });
    }
    if (opts.recurrence) {
      qb.andWhere("tx.recurrence = :rec", { rec: opts.recurrence });
    }
    if (opts.year) {
      const start = startOfMonth(new Date(opts.year, 0, 1));
      const end = endOfMonth(new Date(opts.year, 11, 1));
      qb.andWhere("tx.startDate BETWEEN :start AND :end", { start, end });
    }

    const [items, total] = await qb
      .orderBy("tx.startDate", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  //Soma todas as despesas (TransactionType.EXPENSE) para um projeto específico.
  async sumExpensesForProject(projectId: number): Promise<number> {
    const result = await this.repo
      .createQueryBuilder("tx")
      .select("SUM(tx.amount)", "total")
      .where("tx.projectId = :projectId", { projectId })
      .andWhere("tx.type = :type", { type: TransactionType.EXPENSE })
      .getRawOne<{ total: string }>();

    if (!result || !result.total) {
      return 0; // Se não houver resultado, a soma é 0
    }

    return parseFloat(result.total) || 0;
  }

  async sumExpensesByProjectStatus(
    userId: number,
  ): Promise<{ status: ProjectStatus; total: string }[]> {
    return this.repo
      .createQueryBuilder("tx")
      .innerJoin("tx.project", "p", "p.user.id = :userId", { userId })
      .select("p.status", "status")
      .addSelect("SUM(tx.amount)", "total")
      .where("tx.type = :type", { type: TransactionType.EXPENSE })
      .groupBy("p.status")
      .getRawMany<{ status: ProjectStatus; total: string }>();
  }
}
