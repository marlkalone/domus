import { Injectable } from "@nestjs/common";
import { Task } from "../../../infra/database/entities/task.entity";
import { DataSource, EntityManager, Repository } from "typeorm";
import { TaskFilterDTO } from "../dto/task-filter.dto";
import {
  OverdueByCollaborator,
  TaskCentralStats,
} from "../dto/task-central.dto";
import { TaskStatus } from "../../../common/enums/task.enum";
import { ContactRole } from "../../../common/enums/contact.enums";

@Injectable()
export class TaskRepository {
  private readonly repo: Repository<Task>;

  constructor(private readonly ds: DataSource) {
    this.repo = this.ds.getRepository(Task);
  }

  private getRepository(manager?: EntityManager): Repository<Task> {
    return manager ? manager.getRepository(Task) : this.repo;
  }

  // ===================================================================
  // MÉTODOS DE ESCRITA
  // ===================================================================

  createWithManager(
    manager: EntityManager,
    data: Partial<Task>,
  ): Promise<Task> {
    const entity = this.getRepository(manager).create(data);
    return this.getRepository(manager).save(entity);
  }

  saveWithManager(manager: EntityManager, entity: Task): Promise<Task> {
    return this.getRepository(manager).save(entity);
  }

  async deleteWithManager(manager: EntityManager, entity: Task): Promise<void> {
    await this.getRepository(manager).remove(entity);
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (NÃO TRANSACIONAIS)
  // ===================================================================

  findByUserAndProject(userId: number, projectId: number): Promise<Task[]> {
    return this.repo.find({
      where: {
        project: { id: projectId, user: { id: userId } },
      },
      relations: ["attachments", "contact"],
    });
  }

  findOneByIds(
    userId: number,
    projectId: number,
    taskId: number,
    relations: string[] = ["attachments", "contact"],
  ): Promise<Task | null> {
    return this.repo.findOne({
      where: {
        id: taskId,
        project: { id: projectId, user: { id: userId } },
      },
      relations,
    });
  }

  findOneByIdsWithManager(
    manager: EntityManager,
    userId: number,
    projectId: number,
    taskId: number,
    relations: string[] = ["attachments", "contact"],
  ): Promise<Task | null> {
    return this.getRepository(manager).findOne({
      where: {
        id: taskId,
        project: { id: projectId, user: { id: userId } },
      },
      relations,
    });
  }

  async findTasksForUserOnDate(userId: number, date: Date): Promise<Task[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.user.id = :userId", { userId })
      .leftJoinAndSelect("task.contact", "c")
      .where("task.deadline BETWEEN :dayStart AND :dayEnd", {
        dayStart,
        dayEnd,
      })
      .getMany();
  }

  async findTasksForUserAndProjectOnDate(
    userId: number,
    projectId: number,
    date: Date,
  ): Promise<Task[]> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.id = :pid AND p.user.id = :uid", {
        pid: projectId,
        uid: userId,
      })
      .leftJoinAndSelect("task.contact", "c")
      .where("task.deadline BETWEEN :dayStart AND :dayEnd", {
        dayStart,
        dayEnd,
      })
      .orderBy("task.scheduleTime", "ASC")
      .getMany();
  }

  async findAllPaginated(
    userId: number,
    opts: TaskFilterDTO,
  ): Promise<[Task[], number]> {
    const { skip = 0, limit = 10 } = opts;

    const qb = this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.user.id = :userId", { userId })
      .leftJoinAndSelect("task.contact", "c")
      .leftJoinAndSelect("task.attachments", "att");

    this.applyTaskFilters(qb, opts);

    return qb
      .orderBy("task.deadline", "ASC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();
  }

  // ===================================================================
  // MÉTODOS DE LEITURA (Para getCentralTasksPage)
  // ===================================================================

  async findFilteredTasks(
    userId: number,
    filter: TaskFilterDTO,
  ): Promise<[Task[], number]> {
    const { skip, limit } = filter;

    const qb = this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.user.id = :userId", { userId })
      .leftJoinAndSelect("task.contact", "c")
      .leftJoinAndSelect("task.attachments", "att");

    this.applyTaskFilters(qb, filter);

    return qb
      .orderBy("task.dueDate", "ASC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();
  }

  //Retorna apenas as estatísticas de contagem, usando os mesmos filtros.
  async getTaskStats(
    userId: number,
    opts: TaskFilterDTO,
  ): Promise<TaskCentralStats> {
    const now = new Date();
    const qb = this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.user.id = :userId", { userId })
      .leftJoin("task.contact", "c");

    this.applyTaskFilters(qb, opts);

    const rawStats = await qb
      .select("COUNT(*)", "total")
      .addSelect(
        `SUM(CASE WHEN task.status = :completed THEN 1 ELSE 0 END)`,
        "completed",
      )
      .addSelect(
        `SUM(CASE WHEN task.status != :completed AND task.deadline < :now THEN 1 ELSE 0 END)`,
        "overdue",
      )
      .addSelect(
        `SUM(CASE WHEN task.status != :completed AND task.deadline >= :now THEN 1 ELSE 0 END)`,
        "open",
      )
      .setParameters({ completed: TaskStatus.COMPLETED, now })
      .getRawOne();

    // Converte strings 'raw' para números
    const total = parseInt(rawStats.total, 10) || 0;
    const completed = parseInt(rawStats.completed, 10) || 0;
    const overdue = parseInt(rawStats.overdue, 10) || 0;
    const open = parseInt(rawStats.open, 10) || 0;
    const pctCompleted =
      total > 0 ? +((completed / total) * 100).toFixed(2) : 0;

    return { total, completed, open, overdue, pctCompleted };
  }

  //Retorna estatísticas de tarefas atrasadas por colaborador.
  async getOverdueStatsByCollaborator(
    userId: number,
  ): Promise<OverdueByCollaborator[]> {
    const now = new Date();
    return this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.user.id = :userId", { userId })
      .innerJoin("task.contact", "c", "c.role = :role", {
        role: ContactRole.COLLABORATOR, // Assegura que é um colaborador
      })
      .select("c.id", "contactId")
      .addSelect("c.name", "name")
      .addSelect("COUNT(task.id)", "overdueCount")
      .where("task.status != :completed", { completed: TaskStatus.COMPLETED })
      .andWhere("task.deadline < :now", { now })
      .groupBy("c.id, c.name")
      .orderBy('"overdueCount"', "DESC")
      .getRawMany<OverdueByCollaborator>();
  }

  //Retorna apenas os IDs de colaboradores que tiveram tarefas este mês.
  async getCollaboratorsWithTasksThisMonth(
    userId: number,
  ): Promise<{ contactId: number }[]> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return this.repo
      .createQueryBuilder("task")
      .innerJoin("task.project", "p", "p.user.id = :userId", { userId })
      .select("DISTINCT task.contactId", "contactId") // Apenas IDs distintos
      .where("task.deadline BETWEEN :start AND :end", { start, end })
      .andWhere("task.contactId IS NOT NULL")
      .getRawMany<{ contactId: number }>();
  }

  //Abstrai a lógica de filtro para ser reutilizada.
  private applyTaskFilters(qb: any, opts: TaskFilterDTO) {
    if (opts.projectId) {
      qb.andWhere("p.id = :pid", { pid: opts.projectId });
    }
    if (opts.status) {
      qb.andWhere("task.status = :st", { st: opts.status });
    }
    if (opts.contactRole) {
      qb.andWhere("c.role = :role", { role: opts.contactRole });
    }
    if (opts.period) {
      let start: Date,
        end = new Date();
      end.setHours(23, 59, 59, 999);
      if (opts.period === "day") {
        start = new Date();
        start.setHours(0, 0, 0, 0);
      } else if (opts.period === "week") {
        start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      } else {
        // month
        start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      }
      qb.andWhere("task.deadline BETWEEN :start AND :end", { start, end });
    }
  }
}
