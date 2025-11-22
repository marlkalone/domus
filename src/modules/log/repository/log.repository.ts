import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Log } from "../../../infra/database/entities/log.entity";

@Injectable()
export class LogRepository {
  private readonly repo: Repository<Log>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Log);
  }

  private getRepository(manager: EntityManager): Repository<Log> {
    return manager.getRepository(Log);
  }

  async createLog(manager: EntityManager, log: Partial<Log>): Promise<Log> {
    const auditLog = this.getRepository(manager).create(log);
    return this.getRepository(manager).save(auditLog);
  }
}
