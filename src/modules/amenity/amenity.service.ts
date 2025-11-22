import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { EntityManager } from "typeorm";
import { AttachmentService } from "../attachment/attachment.service";
import { AttachmentOwnerType } from "../../common/enums/subscription.enum";
import { ProjectService } from "../project/project.service";
import { TransactionManagerService } from "../../infra/database/transaction-manager.service";
import { LogService } from "../log/log.service";
import { Amenity } from "../../infra/database/entities/amenity.entity";
import { AmenityRepository } from "./repository/amenity.repository";
import { CreateAmenityDTO } from "./dto/create-amenity.dto";
import { ReadAmenityDTO } from "./dto/read-amenity.dto";
import { AmenityFilterDTO } from "./dto/amenity-filter.dto";
import { AmenityCategory } from "../../common/enums/amenity.enum";
import { UpdateAmenityDTO } from "./dto/update-amenity.dto";
import { ListProjectAmenityDTO } from "./dto/list-project-amenity.dto";
import { plainToInstance } from "class-transformer";
import { DeleteAmenityDTO } from "./dto/delete-amenity.dto";

@Injectable()
export class AmenityService {
  constructor(
    private readonly txManager: TransactionManagerService,
    private readonly amenityRepo: AmenityRepository,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly attachmentService: AttachmentService,
    private readonly logService: LogService,
  ) {}

  async create(userId: number, dto: CreateAmenityDTO): Promise<Amenity> {
    const project = await this.projectService.findOne(userId, dto.projectId);

    return this.txManager.run(async (manager: EntityManager) => {
      const item = await this.amenityRepo.createAndSave(
        {
          name: dto.name,
          description: dto.description,
          category: dto.category,
          condition: dto.condition,
          quantity: dto.quantity,
          includedInSale: dto.includedInSale,
          version: 0,
          project,
        },
        manager,
      );

      if (dto.attachmentKeys?.length) {
        await this.attachmentService.createRecordsWithManager(
          manager,
          AttachmentOwnerType.AMENITY,
          item.id,
          dto.attachmentKeys,
        );
      }

      const createdItem = await this.amenityRepo.findOneByIds(
        userId,
        dto.projectId,
        item.id,
        manager,
      );

      if (!createdItem) {
        throw new InternalServerErrorException(
          "Failed to find created amenity item",
        );
      }

      await this.logService.logCreate(manager, userId, "Amenity", createdItem);

      return createdItem;
    });
  }

  async findOne(userId: number, dto: ReadAmenityDTO) {
    const amenity = await this.amenityRepo.findOneByIds(
      userId,
      dto.projectId,
      dto.amenityId,
    );

    if (!amenity)
      throw new NotFoundException(`Inventory item #${dto.amenityId} not found`);

    return amenity;
  }

  async countTotalItems(userId: number, projectId: number) {
    return this.amenityRepo.countTotalAmenities(userId, projectId);
  }

  async listProjectAmenity(
    userId: number,
    filter: AmenityFilterDTO,
  ): Promise<ListProjectAmenityDTO> {
    await this.projectService.findOne(userId, filter.projectId);

    const { items, total } = await this.amenityRepo.findFilteredPaginated(
      userId,
      filter,
    );

    const totalCount = await this.countTotalItems(userId, filter.projectId);

    const rawByCategory = await this.amenityRepo.countByCategoryForProject(
      userId,
      filter.projectId,
    );

    const totalByCategory: Record<AmenityCategory, number> = {
      [AmenityCategory.FINISHING]: 0,
      [AmenityCategory.FIXED_APPLIANCE]: 0,
      [AmenityCategory.CUSTOM_FURNITURE]: 0,
      [AmenityCategory.INFRASTRUCTURE]: 0,
      [AmenityCategory.LEISURE]: 0,
      [AmenityCategory.MOVABLE_FURNITURE]: 0,
    };

    rawByCategory.forEach(({ category, total: totalStr }) => {
      // <-- 'category'
      totalByCategory[category] = parseInt(totalStr, 10);
    });

    return plainToInstance(ListProjectAmenityDTO, {
      data: items,
      total,
      page: (filter.skip ?? 0) / (filter.limit ?? 10) + 1,
      limit: filter.limit ?? 10,
      totalCount,
      totalByCategory,
    });
  }

  async update(
    userId: number,
    projectId: number,
    amenityId: number,
    dto: UpdateAmenityDTO,
  ): Promise<Amenity> {
    return this.txManager.run(async (manager: EntityManager) => {
      const existing = await this.amenityRepo.findOneByIds(
        userId,
        projectId,
        amenityId,
        manager,
      );

      if (!existing || existing.project.user.id !== userId) {
        throw new NotFoundException(`Amenity #${dto.id} not found`);
      }
      if (existing.version !== dto.version) {
        throw new BadRequestException("Version mismatch");
      }

      await this.logService.logUpdate(
        manager,
        userId,
        "Amenity",
        existing,
        dto,
      );

      existing.name = dto.name ?? existing.name;
      existing.description = dto.description ?? existing.description;
      existing.condition = dto.condition ?? existing.condition;
      existing.category = dto.category ?? existing.category;
      existing.quantity = dto.quantity ?? existing.quantity;
      existing.includedInSale = dto.includedInSale ?? existing.includedInSale;
      existing.version += 1;

      await this.amenityRepo.save(existing, manager);

      if (dto.attachmentKeys) {
        await this.attachmentService.removeAllForOwnerWithManager(
          manager,
          AttachmentOwnerType.AMENITY,
          existing.id,
        );
        if (dto.attachmentKeys.length > 0) {
          await this.attachmentService.createRecordsWithManager(
            manager,
            AttachmentOwnerType.AMENITY,
            existing.id,
            dto.attachmentKeys,
          );
        }
      }

      const updatedItem = await this.amenityRepo.findOneByIds(
        userId,
        projectId,
        amenityId,
        manager,
      );
      if (!updatedItem) {
        throw new InternalServerErrorException(
          "Failed to find updated amenity",
        );
      }

      return updatedItem;
    });
  }

  async remove(dto: DeleteAmenityDTO): Promise<void> {
    const { userId, projectId, amenityId } = dto;

    return this.txManager.run(async (manager: EntityManager) => {
      const existing = await this.amenityRepo.findOneByIds(
        userId,
        projectId,
        amenityId,
        manager,
      );

      if (!existing) {
        throw new NotFoundException(`Amenity #${amenityId} not found`);
      }

      await this.logService.logDelete(manager, userId, "Amenity", existing);

      await this.attachmentService.removeAllForOwnerWithManager(
        manager,
        AttachmentOwnerType.AMENITY,
        amenityId,
      );

      await this.amenityRepo.remove(existing, manager);
    });
  }
}
