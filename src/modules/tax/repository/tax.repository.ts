import { Injectable } from "@nestjs/common";
import { Tax } from "../../../infra/database/entities/tax.entity";
import { DataSource, EntityManager, Repository } from "typeorm";
import { TaxFilterDTO } from "../dto/tax-filter.dto";

@Injectable()
export class TaxRepository {
  private readonly repo: Repository<Tax>;

  constructor(private readonly ds: DataSource) {
    this.repo = this.ds.getRepository(Tax);
  }

  private getRepository(manager?: EntityManager): Repository<Tax> {
    return manager ? manager.getRepository(Tax) : this.repo;
  }

  createEntity(data: Partial<Tax>, manager?: EntityManager): Tax {
    return this.getRepository(manager).create(data);
  }

  save(entity: Tax): Promise<Tax> {
    return this.getRepository().save(entity);
  }

  saveWithManager(manager: EntityManager, entity: Tax): Promise<Tax> {
    return this.getRepository(manager).save(entity);
  }

  remove(entity: Tax): Promise<Tax> {
    return this.getRepository().remove(entity);
  }

  removeWithManager(manager: EntityManager, entity: Tax): Promise<Tax> {
    return this.getRepository(manager).remove(entity);
  }

  findByUser(userId: number, manager?: EntityManager): Promise<Tax[]> {
    return this.getRepository(manager).find({
      where: { user: { id: userId } },
    });
  }

  findOneById(
    id: number,
    manager?: EntityManager,
    relations: string[] = [],
  ): Promise<Tax | null> {
    return this.getRepository(manager).findOne({
      where: { id },
      relations,
    });
  }

  findOneByIdWithManager(
    manager: EntityManager,
    id: number,
    relations: string[] = [],
  ): Promise<Tax | null> {
    return this.findOneById(id, manager, relations);
  }

  findOneByIdAndUser(
    id: number,
    userId: number,
    manager?: EntityManager,
  ): Promise<Tax | null> {
    return this.getRepository(manager).findOne({
      where: { id, user: { id: userId } },
    });
  }

  async findAll(
    userId: number,
    filter: TaxFilterDTO,
  ): Promise<[Tax[], number]> {
    const { skip = 0, limit = 10, title, type } = filter;

    const query = this.repo
      .createQueryBuilder("tax")
      .where("tax.userId = :userId", { userId });

    if (title) {
      query.andWhere("tax.title ILIKE :title", { title: `%${title}%` });
    }

    if (type) {
      query.andWhere("tax.type = :type", { type });
    }

    return query
      .skip(skip)
      .take(limit)
      .orderBy("tax.createdAt", "DESC")
      .getManyAndCount();
  }

  findOneByIdAndUserWithManager(
    manager: EntityManager,
    id: number,
    userId: number,
  ): Promise<Tax | null> {
    return this.getRepository(manager).findOne({
      where: { id, user: { id: userId } },
    });
  }
}
