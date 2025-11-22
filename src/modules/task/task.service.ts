import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { CreateTaskDTO } from "./dto/create-task.dto";
import { ReadTaskDTO } from "./dto/read-task.dto";
import { UpdateTaskDTO } from "./dto/update-task.dto";
import { Task } from "../../infra/database/entities/task.entity";
import { EntityManager } from "typeorm";
import { TaskRepository } from "./repository/task.repository";
import { AttachmentService } from "../attachment/attachment.service";
import { AttachmentOwnerType } from "../../common/enums/subscription.enum";
import { DeleteTaskDTO } from "./dto/delete-task.dto";
import { TaskTodayDTO } from "./dto/tasks-today.dto";
import { format } from "date-fns/format";
import { TaskFilterDTO } from "./dto/task-filter.dto";
import { ContactRole } from "../../common/enums/contact.enums";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { plainToInstance } from "class-transformer";
import {
  OverdueByCollaborator,
  TaskCentralDTO,
  TaskCentralStats,
} from "./dto/task-central.dto";
import { Contact } from "../../infra/database/entities/contact.entity";
import { ContactService } from "../contact/contact.service";
import { ProjectService } from "../project/project.service";
import { Project } from "../../infra/database/entities/project.entity";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { LogService } from "../log/log.service";

@Injectable()
export class TaskService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly taskRepo: TaskRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly contactService: ContactService,
    private readonly attachmentService: AttachmentService,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateTaskDTO): Promise<Task> {
    const project = (await this.projectService.findOne(
      userId,
      dto.projectId,
    )) as Project;

    if (!project)
      throw new NotFoundException(`Project #${dto.projectId} not found`);

    const contact = (await this.contactService.findOne(
      userId,
      dto.contactId,
    )) as Contact;

    if (
      ![ContactRole.COLLABORATOR, ContactRole.PROVIDER].includes(contact.role)
    ) {
      throw new BadRequestException(
        "Contact must be a collaborator or supplier",
      );
    }

    const deadline = new Date(dto.deadline);
    if (isNaN(deadline.getTime()))
      throw new BadRequestException("Invalid deadline date");

    return this.txManager.run(async (manager: EntityManager) => {
      const task = await this.taskRepo.createWithManager(manager, {
        title: dto.title,
        description: dto.description,
        deadline,
        scheduleTime: dto.scheduleTime,
        status: dto.status,
        version: 0,
        project,
        contact,
      });

      // Anexos
      if (dto.attachmentKeys?.length) {
        await this.attachmentService.createRecordsWithManager(
          manager,
          AttachmentOwnerType.TASK,
          task.id,
          dto.attachmentKeys,
        );
      }

      const createdTask = await this.taskRepo.findOneByIdsWithManager(
        manager,
        userId,
        dto.projectId,
        task.id,
      );

      if (!createdTask)
        throw new InternalServerErrorException("Failed to find created task");

      await this.logService.logCreate(manager, userId, "Task", createdTask);

      return createdTask;
    });
  }

  async update(
    userId: number,
    taskId: number,
    dto: UpdateTaskDTO,
  ): Promise<Task> {
    if (dto.deadline) {
      const d = new Date(dto.deadline);
      if (isNaN(d.getTime()))
        throw new BadRequestException("Invalid deadline date");
    }

    return this.txManager.run(async (manager: EntityManager) => {
      const existing = await this.taskRepo.findOneByIdsWithManager(
        manager,
        userId,
        dto.projectId,
        taskId,
        ["project"],
      );

      if (!existing) throw new NotFoundException(`Task #${taskId} not found`);
      if (existing.version !== dto.version) {
        throw new BadRequestException("Version mismatch");
      }

      await this.logService.logUpdate(manager, userId, "Task", existing, dto);

      existing.title = dto.title ?? existing.title;
      existing.description = dto.description ?? existing.description;
      if (dto.deadline) existing.deadline = new Date(dto.deadline);
      existing.scheduleTime = dto.scheduleTime ?? existing.scheduleTime;
      existing.status = dto.status ?? existing.status;
      existing.version += 1;

      await this.taskRepo.saveWithManager(manager, existing);

      // Sincroniza anexos
      if (dto.attachmentKeys) {
        await this.attachmentService.removeAllForOwnerWithManager(
          manager,
          AttachmentOwnerType.TASK,
          existing.id,
        );
        // Apenas adiciona se a lista não estiver vazia
        if (dto.attachmentKeys.length > 0) {
          await this.attachmentService.createRecordsWithManager(
            manager,
            AttachmentOwnerType.TASK,
            existing.id,
            dto.attachmentKeys,
          );
        }
      }

      const updatedTask = await this.taskRepo.findOneByIdsWithManager(
        manager,
        userId,
        dto.projectId,
        existing.id,
      );
      if (!updatedTask)
        throw new InternalServerErrorException("Failed to find updated task");

      return updatedTask;
    });
  }

  async remove(dto: DeleteTaskDTO): Promise<void> {
    return this.txManager.run(async (manager: EntityManager) => {
      const task = await this.taskRepo.findOneByIdsWithManager(
        manager,
        dto.userId,
        dto.projectId,
        dto.id,
      );
      if (!task) {
        throw new NotFoundException(`Task #${dto.id} not found`);
      }

      await this.logService.logDelete(manager, dto.userId, "Project", task);

      await this.attachmentService.removeAllForOwnerWithManager(
        manager,
        AttachmentOwnerType.TASK,
        dto.id,
      );

      await this.taskRepo.deleteWithManager(manager, task);
    });
  }

  // ===================================================================
  // MÉTODOS DE LEITURA
  // ===================================================================

  async findAll(
    userId: number,
    filter: TaskFilterDTO,
  ): Promise<PaginationResponse<Task>> {
    const { skip = 0, limit = 10 } = filter;
    const [data, total] = await this.taskRepo.findAllPaginated(userId, filter);

    return {
      data,
      total,
      page: skip / limit + 1,
      limit,
    };
  }

  async findOne(userId: number, dto: ReadTaskDTO): Promise<Task | Task[]> {
    const t = await this.taskRepo.findOneByIds(
      userId,
      dto.projectId,
      dto.taskId,
    );
    if (!t) throw new NotFoundException(`Task #${dto.taskId} not found`);
    return t;
  }

  async getTodayTasks(userId: number) {
    const today = new Date();
    const tasks = await this.taskRepo.findTasksForUserOnDate(userId, today);

    const items: TaskTodayDTO[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      time: t.scheduleTime ? t.scheduleTime : format(t.deadline, "HH:mm"),
    }));

    return {
      total: items.length,
      items,
    };
  }

  async getTodayTasksByProject(
    userId: number,
    projectId: number,
  ): Promise<{ total: number; items: TaskTodayDTO[] }> {
    const today = new Date();
    const tasks = await this.taskRepo.findTasksForUserAndProjectOnDate(
      userId,
      projectId,
      today,
    );

    const items: TaskTodayDTO[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      time: t.scheduleTime ?? format(t.deadline, "HH:mm"),
    }));

    return {
      total: items.length,
      items,
    };
  }

  async getCentralTasksPage(
    userId: number,
    filter: TaskFilterDTO,
  ): Promise<TaskCentralDTO> {
    const [[tasks], stats, collaborators, overdueByCollab, collabsWithTasks] =
      (await Promise.all([
        this.taskRepo.findFilteredTasks(userId, filter),
        this.taskRepo.getTaskStats(userId, filter),
        this.contactService.findByUserAndRole(userId, ContactRole.COLLABORATOR),
        this.taskRepo.getOverdueStatsByCollaborator(userId),
        this.taskRepo.getCollaboratorsWithTasksThisMonth(userId),
      ])) as [
        [Task[], number],
        TaskCentralStats,
        Contact[],
        OverdueByCollaborator[],
        { contactId: number }[],
      ];

    const totalCollaborators = collaborators.length;
    const collaboratorsWithOverdue = overdueByCollab.length;

    const monthIds = new Set(
      collabsWithTasks.map((c: { contactId: number }) => c.contactId),
    );
    const collaboratorsNoTasksThisMonth = collaborators.filter(
      (c: Contact) => !monthIds.has(c.id),
    ).length;

    return plainToInstance(TaskCentralDTO, {
      tasks,
      stats: stats,
      pagination: {
        total: stats.total,
        page: (filter.skip ?? 0) / (filter.limit ?? 10) + 1,
        limit: filter.limit ?? 10,
      },
      collaboratorStats: {
        totalCollaborators,
        collaboratorsWithOverdue,
        overdueByCollaborator: overdueByCollab.map(
          (o: OverdueByCollaborator) => ({
            ...o,
            overdueCount: Number(o.overdueCount) || 0,
          }),
        ),
        collaboratorsNoTasksThisMonth,
      },
    });
  }
}
