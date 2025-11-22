import {
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  UseGuards,
  Get,
  Query,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { CreateProjectDTO } from "./dto/create-project.dto";
import { UpdateProjectDTO } from "./dto/update-project.dto";
import { ProjectService } from "./project.service";
import { ApiOperation } from "@nestjs/swagger";
import { UserId } from "../../common/decorators/user-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { CheckPermission } from "../../common/decorators/check-permission.decorator";
import { ProjectFilterDTO } from "./dto/project-filter.dto";

@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("projects")
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: "Create a new project" })
  @CheckPermission("PROJECT_MAX_COUNT")
  async create(@Body() dto: CreateProjectDTO, @UserId() userId: number) {
    return this.projectService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List all projects for the user" })
  async findAll(@UserId() user_id: number, @Query() filter: ProjectFilterDTO) {
    return this.projectService.findAll(user_id, filter);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a project by ID" })
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @UserId() userId: number,
  ) {
    await this.projectService.remove(userId, id);
  }

  @ApiOperation({ summary: "Update a project by ID" })
  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @UserId() userId: number,
    @Body() dto: UpdateProjectDTO,
  ) {
    return this.projectService.update(userId, id, dto);
  }
}
