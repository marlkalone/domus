import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Amenity } from "../../../infra/database/entities/amenity.entity";
import { AmenityFilterDTO } from "../dto/amenity-filter.dto";
import { AmenityCategory } from "../../../common/enums/amenity.enum";

@Injectable()
export class AmenityRepository {
  private readonly repo: Repository<Amenity>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Amenity);
  }

  private getManager(manager?: EntityManager): EntityManager {
    return manager || this.dataSource.manager;
  }

  // ===================================================================
  // MÉTODOS DE ESCRITA (Exigem um EntityManager explícito)
  // ===================================================================

  createAndSave(
    data: Partial<Amenity>,
    manager: EntityManager,
  ): Promise<Amenity> {
    const entity = manager.getRepository(Amenity).create(data);
    return manager.getRepository(Amenity).save(entity);
  }

  save(entity: Amenity, manager: EntityManager): Promise<Amenity> {
    return manager.getRepository(Amenity).save(entity);
  }

  remove(entity: Amenity, manager: EntityManager): Promise<Amenity> {
    return manager.getRepository(Amenity).remove(entity);
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (Podem usar o manager padrão ou um transacional)
  // ===================================================================

  findOneByIds(
    userId: number,
    projectId: number,
    amenityId: number,
    manager?: EntityManager,
  ): Promise<Amenity | null> {
    return this.getManager(manager)
      .getRepository(Amenity)
      .findOne({
        where: {
          id: amenityId,
          project: { id: projectId, user: { id: userId } },
        },
        relations: ["attachments"],
      });
  }

  async findFilteredPaginated(
    userId: number,
    filter: AmenityFilterDTO,
    manager?: EntityManager,
  ): Promise<{ items: Amenity[]; total: number }> {
    const {
      projectId,
      category,
      condition,
      name,
      skip = 0,
      limit = 10,
    } = filter;

    const qb = this.getManager(manager)
      .getRepository(Amenity)
      .createQueryBuilder("i")
      .innerJoin("i.project", "p", "p.id = :pid AND p.user.id = :uid", {
        pid: projectId,
        uid: userId,
      })
      .leftJoinAndSelect("i.attachments", "att");

    if (category) {
      qb.andWhere("i.type = :type", { category });
    }
    if (condition) {
      qb.andWhere("i.condition = :cond", { cond: condition });
    }
    if (name) {
      qb.andWhere("i.name ILIKE :nm", { nm: `%${name}%` });
    }

    const [items, total] = await qb
      .orderBy("i.name", "ASC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  async countTotalAmenities(
    userId: number,
    projectId: number,
    manager?: EntityManager,
  ): Promise<number> {
    const result = await this.getManager(manager)
      .getRepository(Amenity)
      .createQueryBuilder("i")
      .innerJoin("i.project", "p", "p.id = :pid AND p.user.id = :uid", {
        pid: projectId,
        uid: userId,
      })
      .select("COUNT(*)", "count")
      .getRawOne<{ count: string }>();

    if (!result || !result.count) {
      return 0;
    }
    return parseInt(result.count, 10);
  }

  async countByCategoryForProject(
    userId: number,
    projectId: number,
    manager?: EntityManager,
  ): Promise<{ category: AmenityCategory; total: string }[]> {
    return this.getManager(manager)
      .getRepository(Amenity)
      .createQueryBuilder("a")
      .select("a.category", "category")
      .addSelect("COUNT(*)", "total")
      .innerJoin("a.project", "p", "p.id = :pid AND p.user.id = :uid", {
        pid: projectId,
        uid: userId,
      })
      .groupBy("a.category")
      .orderBy("a.category")
      .getRawMany<{ category: AmenityCategory; total: string }>();
  }
}
