import { Injectable } from "@nestjs/common";
import { Subscription } from "../../../infra/database/entities/subscription.entity";
import { Between, DataSource, EntityManager, Repository } from "typeorm";
import { SubscriptionStatus } from "../../../common/enums/subscription.enum";

@Injectable()
export class SubscriptionRepository {
  private readonly repo: Repository<Subscription>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Subscription);
  }

  private getRepo(manager?: EntityManager): Repository<Subscription> {
    return manager ? manager.getRepository(Subscription) : this.repo;
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (Usados pelo AdminService)
  // ===================================================================

  findByStatus(
    status: SubscriptionStatus,
    skip: number,
    limit: number,
    manager?: EntityManager,
  ): Promise<[Subscription[], number]> {
    return this.getRepo(manager).findAndCount({
      where: { status },
      relations: ["plan", "user", "user.address", "user.attachments"],
      skip: skip,
      take: limit,
      order: { createdAt: "DESC" },
    });
  }

  findByStatusAndDateRange(
    status: SubscriptionStatus,
    start: Date,
    end: Date,
    manager?: EntityManager,
  ): Promise<Subscription[]> {
    return this.getRepo(manager).find({
      where: {
        status,
        startDate: Between(start, end),
      },
      relations: ["plan"],
    });
  }

  // ===================================================================
  // MÉTODOS DE AGREGAÇÃO
  // ===================================================================

  //Calcula o total de assinaturas ativas e a receita
  async getActiveSubscriptionStats(
    manager?: EntityManager,
  ): Promise<{ totalActive: number; totalRevenue: number }> {
    const repo = this.getRepo(manager);
    const result = await repo
      .createQueryBuilder("sub")
      .innerJoin("sub.plan", "plan")
      .where("sub.status = :status", { status: SubscriptionStatus.ACTIVE })
      .select("COUNT(sub.id)", "totalActive")
      .addSelect("SUM(plan.price)", "totalRevenue")
      .getRawOne<{ totalActive: string; totalRevenue: string }>();

    return {
      totalActive: parseInt(result?.totalActive || "0", 10),
      totalRevenue: parseFloat(result?.totalRevenue || "0"),
    };
  }

  //Calcula a receita mensal agrupada por plano e mês
  async getMonthlyRevenueByPlan(
    start: Date,
    end: Date,
    manager?: EntityManager,
  ): Promise<{ planName: string; month: string; revenue: number }[]> {
    const repo = this.getRepo(manager);

    const raw = await repo
      .createQueryBuilder("sub")
      .innerJoin("sub.plan", "plan")
      .where("sub.status = :status", { status: SubscriptionStatus.ACTIVE })
      .andWhere("sub.startDate BETWEEN :start AND :end", { start, end })
      .select("plan.name", "planName")
      .addSelect("TO_CHAR(sub.startDate, 'MMMM')", "month")
      .addSelect("SUM(plan.price)", "revenue")
      .groupBy("plan.name, TO_CHAR(sub.startDate, 'MMMM')")
      .getRawMany<{ planName: string; month: string; revenue: string }>();

    return raw.map((r) => ({
      planName: r.planName,
      month: r.month.trim(), // TO_CHAR pode adicionar espaços
      revenue: parseFloat(r.revenue || "0"),
    }));
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (Usados pelo SubscriptionService)
  // ===================================================================

  async findLatestByUser(
    userId: number,
    manager?: EntityManager,
  ): Promise<Subscription | null> {
    return this.getRepo(manager).findOne({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
      relations: ["plan"],
    });
  }

  async findByStripeId(
    stripeSubscriptionId: string,
    relations: string[] = [],
    manager?: EntityManager,
  ): Promise<Subscription | null> {
    return this.getRepo(manager).findOne({
      where: { stripeSubscriptionId },
      relations,
    });
  }

  // ===================================================================
  // MÉTODOS DE ESCRITA (Usados pelo SubscriptionService)
  // ===================================================================

  async createOrUpdate(
    dto: Partial<Subscription>,
    manager?: EntityManager,
  ): Promise<Subscription> {
    let sub: Subscription | null = null;

    // 1. Tenta encontrar por Stripe ID (para atualizações e renovações)
    if (dto.stripeSubscriptionId) {
      sub = await this.getRepo(manager).findOne({
        where: { stripeSubscriptionId: dto.stripeSubscriptionId },
      });
    }

    // 2. Se não achou, e temos um DTO com 'userId' e 'status' ATIVO,
    //    tenta encontrar a assinatura 'PENDING' original para "reivindicar".
    if (!sub && dto.user?.id && dto.status === SubscriptionStatus.ACTIVE) {
      sub = await this.getRepo(manager).findOne({
        where: {
          user: { id: dto.user.id },
          status: SubscriptionStatus.PENDING,
        },
        order: { createdAt: "DESC" }, // Pega a mais recente
      });
    }

    if (sub) {
      // ENCONTROU (ou pelo Stripe ID ou pelo User/Pending): Atualiza
      Object.assign(sub, dto);
      sub.updatedAt = new Date(); // Garante que o updatedAt seja atualizado
      return this.getRepo(manager).save(sub);
    } else {
      // NÃO ENCONTROU: Cria
      const newSub = this.getRepo(manager).create(dto);
      return this.getRepo(manager).save(newSub);
    }
  }
}
