import { Injectable } from "@nestjs/common";
import { LogRepository } from "./repository/log.repository";
import { EntityManager } from "typeorm";
import { LogAction } from "../../common/enums/log-action.enum";

@Injectable()
export class LogService {
  constructor(private readonly logRepository: LogRepository) {}

  async logUpdate(
    manager: EntityManager,
    userId: number,
    entityName: string,
    oldEntity: any,
    newDto: any,
  ) {
    const changes = [];

    for (const key in newDto) {
      if (
        key === "version" ||
        key === "id" ||
        typeof newDto[key] === "object"
      ) {
        continue;
      }

      const oldValue = oldEntity[key];
      const newValue = newDto[key];

      if (oldValue !== newValue) {
        changes.push({
          field: key,
          oldValue: oldValue,
          newValue: newValue,
        });
      }
    }

    if (changes.length === 0) {
      return;
    }

    await this.logRepository.createLog(manager, {
      userId,
      action: LogAction.UPDATE,
      entityName,
      entityId: oldEntity.id.toString(),
      changes,
    });
  }

  async logCreate(
    manager: EntityManager,
    userId: number,
    entityName: string,
    createdEntity: any,
  ) {
    const changes = Object.keys(createdEntity).map((key) => ({
      field: key,
      oldValue: null,
      newValue: createdEntity[key],
    }));

    await this.logRepository.createLog(manager, {
      userId,
      action: LogAction.CREATE,
      entityName,
      entityId: createdEntity.id.toString(),
      changes,
    });
  }

  async logDelete(
    manager: EntityManager,
    userId: number,
    entityName: string,
    deletedEntity: any,
  ) {
    const changes = Object.keys(deletedEntity).map((key) => ({
      field: key,
      oldValue: deletedEntity[key],
      newValue: null,
    }));

    await this.logRepository.createLog(manager, {
      userId,
      action: LogAction.DELETE,
      entityName,
      entityId: deletedEntity.id.toString(),
      changes,
    });
  }
}
