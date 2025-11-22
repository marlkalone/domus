import {
  Controller,
  Get,
  Post,
  Body,
  ConflictException,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { FindByIdDTO } from "../user/dto/find-by-id.dto";
import { UserId } from "../../common/decorators/user-id.decorator";
import { Role } from "../../common/enums/user.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateAdminDTO } from "./dto/create-admin.dto";
import { PaginationQueryDTO } from "../../common/utils/pagination-query.dto";

@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: "List active subscriptions with plan details" })
  @Get("subscriptions")
  async getSubscriptionsWithPlans(@Query() pagination: PaginationQueryDTO) {
    return await this.adminService.getSubscriptionsWithPlans(pagination);
  }

  @ApiOperation({ summary: "Monthly revenue by plan (last 12 months)" })
  @Get("monthly-revenue")
  async getMonthlyRevenueByPlan() {
    return await this.adminService.getMonthlyRevenueByPlan();
  }

  @ApiOperation({ summary: "Project counts by status" })
  @Get("projects")
  async getProjectStats() {
    return await this.adminService.getProjectStats();
  }

  @ApiOperation({ summary: "User counts by type" })
  @Get("users")
  async getUserStats() {
    return await this.adminService.getUserStats();
  }

  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a new administrator" })
  @Post("create")
  async createAdmin(@Body() dto: CreateAdminDTO) {
    return this.adminService.create(dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: "Delete a user (cannot delete self)" })
  @Post("delete-user")
  async deleteUser(@Body() dto: FindByIdDTO, @UserId() currentUserId: number) {
    if (dto.user_id === currentUserId) {
      throw new ConflictException("You cannot delete your own account");
    }
    await this.adminService.deleteUser(dto.user_id);
    return { success: true };
  }
}
