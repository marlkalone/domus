import { Injectable } from "@nestjs/common";
import { PlanRepository } from "./repository/plan.repository";
import { Plan } from "../../infra/database/entities/plan.entity";
import { EntityManager } from "typeorm";

@Injectable()
export class PlanService {
  constructor(private readonly repo: PlanRepository) {}

  public async findById(planId: number): Promise<Plan> {
    return await this.repo.findById(planId);
  }

  public async findByCode(
    planCode: string,
    manager?: EntityManager,
  ): Promise<Plan> {
    return await this.repo.findByCode(planCode, manager);
  }

  /**
   * (Admin) Retorna todos os planos disponíveis no sistema.
   */
  public async findAll(): Promise<Plan[]> {
    return await this.repo.findAll();
  }
}
