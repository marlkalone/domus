import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Project } from "../../../infra/database/entities/project.entity";
import { ContactRole } from "../../../common/enums/contact.enums";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { ProjectFilterDTO } from "../dto/project-filter.dto";

@Injectable()
export class ProjectRepository {
  private readonly repo: Repository<Project>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(Project);
  }

  private getRepository(manager?: EntityManager): Repository<Project> {
    return manager ? manager.getRepository(Project) : this.repo;
  }

  // ===================================================================
  // MÉTODOS DE ESCRITA
  // ===================================================================

  createWithManager(
    manager: EntityManager,
    partial: Partial<Project>,
  ): Project {
    return this.getRepository(manager).create(partial);
  }

  saveWithManager(manager: EntityManager, entity: Project): Promise<Project> {
    return this.getRepository(manager).save(entity);
  }

  async deleteWithManager(
    manager: EntityManager,
    entity: Project,
  ): Promise<void> {
    await this.getRepository(manager).remove(entity);
  }

  findOneByIdWithManager(
    manager: EntityManager,
    id: number,
    userId: number,
  ): Promise<Project | null> {
    return this.getRepository(manager).findOne({
      where: { id, user: { id: userId } },
      relations: ["address", "details", "attachments"],
    });
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (NÃO TRANSACIONAIS)
  // ===================================================================

  async findAllPaginated(
    userId: number,
    filter: ProjectFilterDTO,
  ): Promise<[Project[], number]> {
    const { skip = 0, limit = 10, status, title } = filter;

    const qb = this.repo
      .createQueryBuilder("project")
      .leftJoinAndSelect("project.address", "address")
      .leftJoinAndSelect("project.details", "details")
      .leftJoinAndSelect("project.attachments", "attachments")
      .where("project.user.id = :userId", { userId });

    if (status) {
      qb.andWhere("project.status = :status", { status });
    }

    if (title) {
      qb.andWhere("project.title ILIKE :title", { title: `%${title}%` });
    }

    return qb
      .orderBy("project.id", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();
  }

  findOneByIdAndUser(id: number, userId: number): Promise<Project | null> {
    return this.repo.findOne({
      where: { id, user: { id: userId } },
      relations: ["address", "details", "attachments"],
    });
  }

  countAll(): Promise<number> {
    return this.repo.count();
  }

  async countByStatusForUser(
    userId: number | null,
  ): Promise<{ status: ProjectStatus; total: number }[]> {
    const qb = this.repo
      .createQueryBuilder("project")
      .select("project.status", "status")
      .addSelect("COUNT(project.id)", "total")
      .groupBy("project.status");

    if (userId) {
      qb.innerJoin("project.user", "user").where("user.id = :userId", {
        userId,
      });
    }
    // ----------------

    const raw = await qb.getRawMany<{ status: ProjectStatus; total: string }>();

    return raw.map((r) => ({
      status: r.status,
      total: parseInt(r.total, 10),
    }));
  }

  async countCollaborators(projectId: number): Promise<number> {
    const count = await this.repo
      .createQueryBuilder("p")
      .innerJoin("p.tasks", "t")
      .innerJoin("t.contact", "c", "c.role = :role", {
        role: ContactRole.COLLABORATOR,
      })
      .where("p.id = :projectId", { projectId })
      .select("COUNT(DISTINCT c.id)", "count")
      .getRawOne<{ count: string }>();

    if (!count) return 0;

    return parseInt(count.count, 10);
  }
}
