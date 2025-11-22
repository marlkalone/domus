import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Plan } from "../../../infra/database/entities/plan.entity";
import { DataSource, EntityManager, Repository } from "typeorm";

@Injectable()
export class PlanRepository {
  private readonly repo: Repository<Plan>;

  constructor(
    private readonly dataSource: DataSource, // 1. Injete o DataSource
  ) {
    this.repo = this.dataSource.getRepository(Plan);
  }

  /**
   * Retorna o repositório apropriado (transacional ou padrão).
   */
  private getRepo(manager?: EntityManager): Repository<Plan> {
    return manager ? manager.getRepository(Plan) : this.repo;
  }

  /**
   * Encontra todos os planos.
   * Usado pelo AdminService.
   */
  findAll(manager?: EntityManager): Promise<Plan[]> {
    return this.getRepo(manager).find();
  }

  async findById(id: number, manager?: EntityManager): Promise<Plan> {
    const plan = await this.getRepo(manager).findOne({ where: { id } });

    if (!plan) throw new NotFoundException(`Plan #${id} not found`);

    return plan;
  }

  /**
   * Encontra um plano pelo seu código (ex: "FREE", "PRO").
   * Usado transacionalmente pelo UserService e AdminService.
   */
  async findByCode(code: string, manager?: EntityManager): Promise<Plan> {
    const plan = await this.getRepo(manager).findOne({ where: { code } });

    if (!plan) {
      throw new NotFoundException(`Plan with code "${code}" not found`);
    }

    return plan;
  }
}
