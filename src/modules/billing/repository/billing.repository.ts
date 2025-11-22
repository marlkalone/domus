import { Injectable } from "@nestjs/common";
import { Billing } from "../../../infra/database/entities/billing.entity";
import { DataSource, EntityManager, Repository } from "typeorm";
import { BillingStatus } from "../../../common/enums/billing.enum";
import { BillingFilterDTO } from "../dto/billing-filter.dto";

@Injectable()
export class BillingRepository {
  private readonly repo: Repository<Billing>;

  constructor(private readonly ds: DataSource) {
    this.repo = this.ds.getRepository(Billing);
  }

  private getRepository(manager?: EntityManager): Repository<Billing> {
    return manager ? manager.getRepository(Billing) : this.repo;
  }

  async findAll(
    userId: number,
    filter: BillingFilterDTO,
  ): Promise<[Billing[], number]> {
    const { skip = 0, limit = 10, status, projectId } = filter;

    const qb = this.repo
      .createQueryBuilder("billing")
      .innerJoin(
        "billing.project",
        "project",
        "project.id = :projectId AND project.user.id = :userId",
        { projectId, userId },
      )
      .leftJoinAndSelect("billing.contact", "contact");

    if (status) {
      qb.andWhere("billing.status = :status", { status });
    }

    return qb
      .orderBy("billing.dueDate", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();
  }

  findOneByIds(
    userId: number,
    projectId: number,
    billingId: number,
  ): Promise<Billing | null> {
    return this.repo.findOne({
      where: {
        id: billingId,
        project: { id: projectId, user: { id: userId } },
      },
    });
  }
}
