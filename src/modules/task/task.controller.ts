import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UserId } from "../../common/decorators/user-id.decorator";
import { TaskService } from "./task.service";
import { CreateTaskDTO } from "./dto/create-task.dto";
import { UpdateTaskDTO } from "./dto/update-task.dto";
import { Role } from "../../common/enums/user.enum";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { TaskFilterDTO } from "./dto/task-filter.dto";
import { CheckPermission } from "../../common/decorators/check-permission.decorator";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { Task } from "../../infra/database/entities/task.entity";

@ApiTags("Tasks")
@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("tasks")
export class TaskController {
  constructor(private readonly service: TaskService) {}

  @ApiOperation({ summary: "Create a new task" })
  @Post()
  @CheckPermission("TASK_ACTIVE_LIMIT")
  async create(@Body() dto: CreateTaskDTO, @UserId() userId: number) {
    return this.service.create(userId, dto);
  }

  @ApiOperation({ summary: "List tasks for a project" })
  @Get()
  async findAll(
    @UserId() userId: number,
    @Query() filter: TaskFilterDTO,
  ): Promise<PaginationResponse<Task>> {
    return this.service.findAll(userId, filter);
  }

  @ApiOperation({ summary: "Get one task" })
  @Get(":id")
  async findOne(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Query("projectId", ParseIntPipe) projectId: number,
  ) {
    return this.service.findOne(userId, { projectId: projectId, taskId: id });
  }

  @ApiOperation({ summary: "Update a task" })
  @Patch(":id")
  async update(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDTO,
  ) {
    return this.service.update(userId, id, dto);
  }

  @ApiOperation({ summary: "Delete a task" })
  @Delete(":id")
  async remove(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Query("projectId", ParseIntPipe) projectId: number,
  ) {
    await this.service.remove({ userId, projectId, id });
  }
}
