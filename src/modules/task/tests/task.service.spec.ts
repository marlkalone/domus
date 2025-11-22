import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { TaskService } from "../task.service";
import { Project } from "../../../infra/database/entities/project.entity";
import { Contact } from "../../../infra/database/entities/contact.entity";
import { TaskRepository } from "../repository/task.repository";
import { ContactRole } from "../../../common/enums/contact.enums";
import { TaskStatus } from "../../../common/enums/task.enum";
import { ProjectService } from "../../project/project.service";
import { ContactService } from "../../contact/contact.service";
import { AttachmentService } from "../../attachment/attachment.service";
import { Task } from "../../../infra/database/entities/task.entity";
import { LogService } from "../../log/log.service";
import { TransactionManagerService } from "../../../infra/database/transaction-manager.service";
import { CreateTaskDTO } from "../dto/create-task.dto";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";
import { UpdateTaskDTO } from "../dto/update-task.dto";
import { DeleteTaskDTO } from "../dto/delete-task.dto";
import { TaskFilterDTO } from "../dto/task-filter.dto";
import { PaginationResponse } from "../../../common/utils/pagination-response";
import {
  OverdueByCollaborator,
  TaskCentralStats,
} from "../dto/task-central.dto";

const mockEntityManager = {
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  findOne: jest.fn(),
};

describe("TaskService", () => {
  let service: TaskService;
  let mockTaskRepo: any;
  let mockProjectService: any;
  let mockContactService: any;
  let mockAttachmentService: any;
  let mockLogService: any;
  let mockTxManager: any;

  const mockProject: Project = { id: 1 } as Project;
  const mockCollaborator: Contact = {
    id: 1,
    role: ContactRole.COLLABORATOR,
  } as Contact;
  const mockClient: Contact = { id: 2, role: ContactRole.TENANT } as Contact;
  const mockTask: Task = {
    id: 1,
    title: "Test Task",
    status: TaskStatus.PENDING,
    version: 0,
    project: mockProject,
    contact: mockCollaborator,
    deadline: new Date(),
  } as Task;

  beforeEach(async () => {
    mockTaskRepo = {
      createWithManager: jest.fn(),
      findOneByIdsWithManager: jest.fn(),
      saveWithManager: jest.fn(),
      deleteWithManager: jest.fn(),
      findAllPaginated: jest.fn(),
      findOneByIds: jest.fn(),
      findTasksForUserOnDate: jest.fn(),
      findTasksForUserAndProjectOnDate: jest.fn(),
      findFilteredTasks: jest.fn(),
      getTaskStats: jest.fn(),
      getOverdueStatsByCollaborator: jest.fn(),
      getCollaboratorsWithTasksThisMonth: jest.fn(),
    };

    mockProjectService = {
      findOne: jest.fn(),
    };

    mockContactService = {
      findOne: jest.fn(),
      findByUserAndRole: jest.fn(),
    };

    mockAttachmentService = {
      createRecordsWithManager: jest.fn(),
      removeAllForOwnerWithManager: jest.fn(),
    };

    mockLogService = {
      logCreate: jest.fn(),
      logUpdate: jest.fn(),
      logDelete: jest.fn(),
    };

    mockTxManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockEntityManager as unknown as EntityManager);
      }),
    };

    mockEntityManager.create.mockClear();
    mockEntityManager.save.mockClear();
    mockEntityManager.remove.mockClear();
    mockEntityManager.findOne.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepository, useValue: mockTaskRepo },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: ContactService, useValue: mockContactService },
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: LogService, useValue: mockLogService },
        { provide: TransactionManagerService, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const userId = 1;
    const createDto: CreateTaskDTO = {
      projectId: 1,
      contactId: 1,
      title: "New Task",
      description: "...",
      deadline: new Date().toISOString(),
      status: TaskStatus.PENDING,
      attachmentKeys: [
        { key: "key1", originalName: "doc.pdf", mimeType: "app/pdf" },
      ],
    };

    it("should create a task successfully", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockContactService.findOne.mockResolvedValue(mockCollaborator);
      mockTaskRepo.createWithManager.mockResolvedValue(mockTask);
      mockTaskRepo.findOneByIdsWithManager.mockResolvedValue(mockTask);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(mockTask);
      expect(mockProjectService.findOne).toHaveBeenCalledWith(
        userId,
        createDto.projectId,
      );
      expect(mockContactService.findOne).toHaveBeenCalledWith(
        userId,
        createDto.contactId,
      );
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockTaskRepo.createWithManager).toHaveBeenCalled();
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.TASK,
        mockTask.id,
        createDto.attachmentKeys,
      );
      expect(mockLogService.logCreate).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        userId,
        "Task",
        mockTask,
      );
    });

    it("should throw NotFoundException if project not found", async () => {
      mockProjectService.findOne.mockResolvedValue(null);
      await expect(service.create(userId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if contact is not collaborator or provider", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockContactService.findOne.mockResolvedValue(mockClient); // Mock um cliente

      await expect(service.create(userId, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException for invalid deadline", async () => {
      mockProjectService.findOne.mockResolvedValue(mockProject);
      mockContactService.findOne.mockResolvedValue(mockCollaborator);

      const invalidDto = { ...createDto, deadline: "invalid-date" };

      await expect(service.create(userId, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("update", () => {
    const userId = 1;
    const taskId = 1;
    const updateDto: UpdateTaskDTO = {
      projectId: 1,
      contactId: 1,
      version: 0,
      title: "Updated Title",
      status: TaskStatus.COMPLETED,
      attachmentKeys: [], // Remove todos os anexos
    };

    let testMockTask: Task;
    beforeEach(() => {
      // Isso cria uma cópia "limpa" (com version: 0) para cada teste
      testMockTask = JSON.parse(JSON.stringify(mockTask));
    });

    it("should update a task successfully", async () => {
      mockTaskRepo.findOneByIdsWithManager
        .mockResolvedValueOnce(testMockTask)
        .mockResolvedValueOnce({ ...testMockTask, ...updateDto, version: 1 });

      const result = await service.update(userId, taskId, updateDto);

      expect(result.title).toBe("Updated Title");
      expect(result.version).toBe(1);
      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockTaskRepo.findOneByIdsWithManager).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        userId,
        updateDto.projectId,
        taskId,
        ["project"],
      );
      expect(mockLogService.logUpdate).toHaveBeenCalled();
      expect(mockTaskRepo.saveWithManager).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        expect.objectContaining({ title: "Updated Title", version: 1 }),
      );
      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.TASK,
        taskId,
      );
      expect(
        mockAttachmentService.createRecordsWithManager,
      ).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if task not found", async () => {
      mockTaskRepo.findOneByIdsWithManager.mockResolvedValue(null);

      await expect(service.update(userId, taskId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException on version mismatch", async () => {
      const mismatchedDto = { ...updateDto, version: 1 };

      mockTaskRepo.findOneByIdsWithManager.mockResolvedValue(testMockTask);

      await expect(
        service.update(userId, taskId, mismatchedDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    const deleteDto: DeleteTaskDTO = { userId: 1, projectId: 1, id: 1 };

    it("should remove a task and its attachments", async () => {
      mockTaskRepo.findOneByIdsWithManager.mockResolvedValue(mockTask);

      await service.remove(deleteDto);

      expect(mockTxManager.run).toHaveBeenCalled();
      expect(mockTaskRepo.findOneByIdsWithManager).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        deleteDto.userId,
        deleteDto.projectId,
        deleteDto.id,
      );
      expect(mockLogService.logDelete).toHaveBeenCalled();
      expect(
        mockAttachmentService.removeAllForOwnerWithManager,
      ).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        AttachmentOwnerType.TASK,
        deleteDto.id,
      );
      expect(mockTaskRepo.deleteWithManager).toHaveBeenCalledWith(
        mockEntityManager as unknown as EntityManager,
        mockTask,
      );
    });

    it("should throw NotFoundException if task not found on remove", async () => {
      mockTaskRepo.findOneByIdsWithManager.mockResolvedValue(null);

      await expect(service.remove(deleteDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated tasks", async () => {
      const filter: TaskFilterDTO = { skip: 0, limit: 10 };
      const responseData: [Task[], number] = [[mockTask], 1];
      mockTaskRepo.findAllPaginated.mockResolvedValue(responseData);

      const result = await service.findAll(1, filter);

      const expectedResponse: PaginationResponse<Task> = {
        data: [mockTask],
        total: 1,
        page: 1,
        limit: 10,
      };

      expect(result).toEqual(expectedResponse);
    });
  });

  describe("getCentralTasksPage", () => {
    it("should aggregate task and collaborator stats", async () => {
      const filter: TaskFilterDTO = { skip: 0, limit: 10 };
      const stats: TaskCentralStats = {
        total: 1,
        completed: 0,
        open: 1,
        overdue: 0,
        pctCompleted: 0,
      };
      const collaborators = [mockCollaborator];
      const overdueCollabs: OverdueByCollaborator[] = [];
      const collabsWithTasks = [{ contactId: 1 }];

      mockTaskRepo.findFilteredTasks.mockResolvedValue([[mockTask], 1]);
      mockTaskRepo.getTaskStats.mockResolvedValue(stats);
      mockContactService.findByUserAndRole.mockResolvedValue(collaborators);
      mockTaskRepo.getOverdueStatsByCollaborator.mockResolvedValue(
        overdueCollabs,
      );
      mockTaskRepo.getCollaboratorsWithTasksThisMonth.mockResolvedValue(
        collabsWithTasks,
      );

      const result = await service.getCentralTasksPage(1, filter);

      expect(result.tasks).toEqual([mockTask]);
      expect(result.stats.total).toBe(1);
      expect(result.collaboratorStats.totalCollaborators).toBe(1);
      expect(result.collaboratorStats.collaboratorsWithOverdue).toBe(0);
      expect(result.collaboratorStats.collaboratorsNoTasksThisMonth).toBe(0);
    });
  });
});
