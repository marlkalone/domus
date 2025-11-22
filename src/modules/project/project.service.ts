import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { CreateProjectDTO } from "./dto/create-project.dto";
import { Project } from "../../infra/database/entities/project.entity";
import { ProjectAddress } from "../../infra/database/entities/projectAddress.entity";
import { ProjectDetail } from "../../infra/database/entities/projectDetail.entity";
import { AttachmentService } from "../attachment/attachment.service";
import { AttachmentOwnerType } from "../../common/enums/subscription.enum";
import { ProjectRepository } from "./repository/project.repository";
import { ProjectStatus } from "../../common/enums/project.enum";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { EntityManager } from "typeorm";
import { UpdateProjectDTO } from "./dto/update-project.dto";
import { isProjectDetailValid } from "../../common/utils/project.utils";
import { ProjectFilterDTO } from "./dto/project-filter.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { Attachment } from "../../infra/database/entities/attachment.entity";
import { LogService } from "../log/log.service";

@Injectable()
export class ProjectService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly projectRepo: ProjectRepository,
    private readonly attachmentService: AttachmentService,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateProjectDTO): Promise<Project> {
    return this.txManager.run(async (manager: EntityManager) => {
      const project = this.projectRepo.createWithManager(manager, {
        status: dto.status || ProjectStatus.PRE_ACQUISITION,
        title: dto.title,
        acquisitionType: dto.acquisition_type,
        acquisitionPrice: dto.acquisitionPrice,
        targetSalePrice: dto.targetSalePrice,
        version: 0,
        user: { id: userId } as any,
      });

      const savedProject = await this.projectRepo.saveWithManager(
        manager,
        project,
      );

      const address = manager.create(ProjectAddress, {
        ...dto.address,
        project: savedProject,
      });
      await manager.save(address);

      if (dto.details?.length) {
        console.log(dto.details);
        const valid = dto.details.filter(isProjectDetailValid);
        console.log("valid", valid);
        const details = valid.map((d) =>
          manager.create(ProjectDetail, {
            key: d.key,
            value: d.value.toString(),
            project: savedProject,
          }),
        );
        await manager.save(details);
      }

      if (dto.attachs?.length) {
        await this.attachmentService.createRecordsWithManager(
          manager,
          AttachmentOwnerType.PROJECT,
          savedProject.id,
          dto.attachs,
        );
      }

      const newProject = await manager.findOne(Project, {
        where: { id: savedProject.id },
        relations: ["address", "details", "attachments"],
      });

      if (!newProject) {
        throw new InternalServerErrorException(
          "Failed to find created project!",
        );
      }

      await this.logService.logCreate(manager, userId, "Project", newProject);

      return newProject;
    });
  }

  async saveWithManager(
    manager: EntityManager,
    project: Project,
  ): Promise<Project> {
    return await this.projectRepo.saveWithManager(manager, project);
  }

  async findOne(userId: number, id: number): Promise<Project> {
    const proj = await this.projectRepo.findOneByIdAndUser(id, userId);
    if (!proj) throw new NotFoundException(`Project #${id} not found`);
    return proj;
  }

  async findAll(
    userId: number,
    filter: ProjectFilterDTO,
  ): Promise<PaginationResponse<Project>> {
    const { skip, limit } = filter;
    const [data, total] = await this.projectRepo.findAllPaginated(
      userId,
      filter,
    );

    return {
      data,
      total,
      page: skip / limit + 1,
      limit,
    };
  }

  async countByStatusForUser(
    userId: number,
  ): Promise<{ status: ProjectStatus; total: number }[]> {
    return this.projectRepo.countByStatusForUser(userId);
  }

  async countCollaborators(projectId: number): Promise<number> {
    return this.projectRepo.countCollaborators(projectId);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateProjectDTO,
  ): Promise<Project> {
    return this.txManager.run(async (manager: EntityManager) => {
      const existing = await this.projectRepo.findOneByIdWithManager(
        manager,
        id,
        userId,
      );

      if (!existing) throw new NotFoundException(`Project #${id} not found`);
      if (existing.version !== dto.version)
        throw new BadRequestException("Project version mismatch");

      await this.logService.logUpdate(
        manager,
        userId,
        "Project",
        existing,
        dto,
      );

      existing.status = dto.status;
      existing.title = dto.title;
      existing.acquisitionType = dto.acquisition_type;
      existing.acquisitionPrice = dto.acquisitionPrice;
      existing.targetSalePrice = dto.targetSalePrice;
      existing.version += 1;

      await this.projectRepo.saveWithManager(manager, existing);

      Object.assign(existing.address, dto.address);
      await manager.save(ProjectAddress, existing.address);

      const validNewDetails = dto.details
        ? dto.details.filter(isProjectDetailValid)
        : [];

      const existingDetailsMap = new Map(
        existing.details.map((d) => [d.key, d]),
      );

      const newDetailsMap = new Map(validNewDetails.map((d) => [d.key, d]));

      const toDelete: ProjectDetail[] = [];
      const toSave: ProjectDetail[] = [];

      for (const existingDetail of existing.details) {
        if (!newDetailsMap.has(existingDetail.key)) {
          toDelete.push(existingDetail);
        }
      }

      // Encontra detalhes para ADICIONAR ou ATUALIZAR
      for (const newDetailDto of validNewDetails) {
        const existingDetail = existingDetailsMap.get(newDetailDto.key);
        const newValue = newDetailDto.value.toString();

        if (existingDetail) {
          // Atualizar: se o valor mudou
          if (existingDetail.value !== newValue) {
            existingDetail.value = newValue;
            toSave.push(existingDetail);
          }
        } else {
          // Adicionar: se não existia
          const newDetailEntity = manager.create(ProjectDetail, {
            key: newDetailDto.key,
            value: newValue,
            project: existing,
          });
          toSave.push(newDetailEntity);
        }
      }

      // Executa as operações no banco de dados
      if (toDelete.length > 0) {
        await manager.remove(toDelete);
      }
      if (toSave.length > 0) {
        await manager.save(toSave);
      }

      // 4) Anexos
      const newAttachmentKeys = dto.attachmentKeys || [];

      // usa 'url' para armazenar a 'key' do S3
      const existingAttachmentsMap = new Map(
        existing.attachments.map((a) => [a.url, a]),
      );
      const newAttachmentKeysMap = new Map(
        newAttachmentKeys.map((k) => [k.key, k]),
      );

      const attachmentsToDelete: Attachment[] = [];
      const attachmentKeysToCreate: {
        key: string;
        originalName: string;
        mimeType: string;
      }[] = [];

      // Encontra anexos para DELETAR
      for (const existingAtt of existing.attachments) {
        if (!newAttachmentKeysMap.has(existingAtt.url)) {
          attachmentsToDelete.push(existingAtt);
        }
      }

      // Encontra anexos para ADICIONAR
      for (const newKeyDto of newAttachmentKeys) {
        if (!existingAttachmentsMap.has(newKeyDto.key)) {
          attachmentKeysToCreate.push(newKeyDto);
        }
      }

      // Executa operações no banco e na fila
      if (attachmentsToDelete.length > 0) {
        await manager.remove(attachmentsToDelete);

        for (const att of attachmentsToDelete) {
          await this.attachmentService.queueCleanupJob(att.url);
        }
      }
      if (attachmentKeysToCreate.length > 0) {
        await this.attachmentService.createRecordsWithManager(
          manager,
          AttachmentOwnerType.PROJECT,
          existing.id,
          attachmentKeysToCreate,
        );
      }

      // 5) Retorna atualizado
      const project = await manager.findOne(Project, {
        where: { id: existing.id },
        relations: ["address", "details", "attachments"],
      });

      if (!project) {
        throw new NotFoundException("Project not found for id: ${id}");
      }

      return project;
    });
  }

  async remove(userId: number, projectId: number): Promise<void> {
    return this.txManager.run(async (manager: EntityManager) => {
      const proj = await this.projectRepo.findOneByIdAndUser(projectId, userId);
      if (!proj) throw new NotFoundException(`Project #${projectId} not found`);

      await this.logService.logDelete(manager, userId, "Project", proj);

      await this.attachmentService.removeAllForOwnerWithManager(
        manager,
        AttachmentOwnerType.PROJECT,
        proj.id,
      );

      await this.projectRepo.deleteWithManager(manager, proj);
    });
  }

  // ===================================================================
  // MÉTODOS PARA ADMIN
  // ===================================================================

  //(Admin) Conta o total de projetos no sistema.
  async adminCountAll(): Promise<number> {
    return this.projectRepo.countAll();
  }

  //(Admin) Conta projetos por status (para todos os usuários).
  async adminCountByStatus(): Promise<
    { status: ProjectStatus; total: number }[]
  > {
    // Passa 'null' para o repositório pular o filtro de usuário
    return this.projectRepo.countByStatusForUser(null);
  }
}
