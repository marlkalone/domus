import {
  Injectable,
  ForbiddenException,
  ExecutionContext,
} from "@nestjs/common";
import { DataSource, Like, MoreThanOrEqual } from "typeorm";
import { IPermissionHandler } from "./permission.handler.interface";
import { AttachmentOwnerType } from "../../enums/subscription.enum";
import { Project } from "../../../infra/database/entities/project.entity";
import { Attachment } from "../../../infra/database/entities/attachment.entity";
import { Contact } from "../../../infra/database/entities/contact.entity";
import { Task } from "../../../infra/database/entities/task.entity";
import { Transaction } from "../../../infra/database/entities/transaction.entity";
import { TaskStatus } from "../../enums/task.enum";
import { Amenity } from "../../../infra/database/entities/amenity.entity";

/**
 * Verifica o limite de 'PROJECT_MAX_COUNT'.
 */
@Injectable()
export class ProjectMaxCountHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
  ): Promise<void> {
    const limit = permMap.get("PROJECT_MAX_COUNT") as number;
    if (typeof limit !== "number") return; // null ou undefined = ilimitado

    const count = await this.ds
      .getRepository(Project)
      .count({ where: { user: { id: user.id } } });

    if (count >= limit) {
      throw new ForbiddenException("Project limit reached");
    }
  }
}

/**
 * Verifica o limite de 'PROJECT_PHOTO_LIMIT'.
 * Requer que o ID do projeto esteja em req.params.id
 */
@Injectable()
export class ProjectPhotoLimitHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
    context: ExecutionContext,
  ): Promise<void> {
    const limit = permMap.get("PROJECT_PHOTO_LIMIT") as number;
    if (typeof limit !== "number") return;

    const req = context.switchToHttp().getRequest();
    const projectId = Number(req.params.id);
    if (!projectId) {
      throw new ForbiddenException(
        "Project ID not found in request parameters",
      );
    }

    const count = await this.ds.getRepository(Attachment).count({
      where: {
        ownerType: AttachmentOwnerType.PROJECT,
        ownerId: projectId,
        mimeType: Like("image/%"),
      },
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Photo limit of ${limit} reached for project #${projectId}`,
      );
    }
  }
}

/**
 * Verifica o limite de 'PROJECT_VIDEO_LIMIT'.
 * Requer que o ID do projeto esteja em req.params.id
 */
@Injectable()
export class ProjectVideoLimitHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
    context: ExecutionContext,
  ): Promise<void> {
    const limit = permMap.get("PROJECT_VIDEO_LIMIT") as number;
    if (typeof limit !== "number") return;

    const req = context.switchToHttp().getRequest();
    const projectId = Number(req.params.id);
    if (!projectId) {
      throw new ForbiddenException(
        "Project ID not found in request parameters",
      );
    }

    const count = await this.ds.getRepository(Attachment).count({
      where: {
        ownerType: AttachmentOwnerType.PROJECT,
        ownerId: projectId,
        mimeType: Like("video/%"),
      },
    });

    if (count >= limit) {
      throw new ForbiddenException(
        `Video limit of ${limit} reached for project #${projectId}`,
      );
    }
  }
}

/**
 * Verifica o limite de 'AMENITIES_PER_PROJECT'.
 * Requer que o ID do projeto esteja em req.body.projectId
 */
@Injectable()
export class AmenitiesPerProjectHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
    context: ExecutionContext,
  ): Promise<void> {
    const limit = permMap.get("AMENITIES_PER_PROJECT") as number;
    if (typeof limit !== "number") return;

    const req = context.switchToHttp().getRequest();
    const projectId = req.body.projectId; // Depende do DTO
    if (!projectId) {
      throw new ForbiddenException("projectId not found in request body");
    }

    const count = await this.ds.getRepository(Amenity).count({
      where: {
        project: { id: projectId },
      },
    });

    if (count >= limit) {
      throw new ForbiddenException(
        "Inventory item limit reached for this project",
      );
    }
  }
}

/**
 * Verifica o limite de 'CONTACT_MAX_COUNT'.
 */
@Injectable()
export class ContactMaxCountHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
  ): Promise<void> {
    const limit = permMap.get("CONTACT_MAX_COUNT") as number;
    if (typeof limit !== "number") return;

    const count = await this.ds
      .getRepository(Contact)
      .count({ where: { user: { id: user.id } } });

    if (count >= limit) {
      throw new ForbiddenException("Contact limit reached");
    }
  }
}

/**
 * Verifica o limite de 'TASK_ACTIVE_LIMIT'.
 */
@Injectable()
export class TaskActiveLimitHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
  ): Promise<void> {
    const limit = permMap.get("TASK_ACTIVE_LIMIT") as number;
    if (typeof limit !== "number") return;

    const count = await this.ds.getRepository(Task).count({
      where: {
        project: { user: { id: user.id } },
        status: TaskStatus.PENDING,
      },
    });

    if (count >= limit) {
      throw new ForbiddenException("Active task limit reached");
    }
  }
}

/**
 * Verifica o limite de 'TX_MONTHLY_LIMIT'.
 */
@Injectable()
export class TxMonthlyLimitHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
  ): Promise<void> {
    const limit = permMap.get("TX_MONTHLY_LIMIT") as number;
    if (typeof limit !== "number") return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const count = await this.ds.getRepository(Transaction).count({
      where: {
        project: { user: { id: user.id } },
        createdAt: MoreThanOrEqual(startOfMonth),
      },
    });

    if (count >= limit) {
      throw new ForbiddenException("Monthly transaction limit reached");
    }
  }
}

/**
 * Verifica o booleano 'TAX_ENABLED'.
 */
@Injectable()
export class TaxEnabledHandler implements IPermissionHandler {
  async check(permMap: Map<string, number | boolean | null>): Promise<void> {
    const allowed = permMap.get("TAX_ENABLED") as boolean;
    if (!allowed) {
      throw new ForbiddenException("Tax module not enabled for your plan");
    }
  }
}

/**
 * Verifica o limite de 'ATTACH_TOTAL_COUNT'.
 */
@Injectable()
export class AttachTotalCountHandler implements IPermissionHandler {
  constructor(private ds: DataSource) {}

  async check(
    permMap: Map<string, number | boolean | null>,
    user: any,
  ): Promise<void> {
    const limit = permMap.get("ATTACH_TOTAL_COUNT") as number;
    if (typeof limit !== "number") return;

    const count = await this.ds
      .getRepository(Attachment)
      .count({ where: { user: { id: user.id } } });

    if (count >= limit) {
      throw new ForbiddenException("Total attachment limit reached");
    }
  }
}
