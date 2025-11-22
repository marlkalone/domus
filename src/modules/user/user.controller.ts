import {
  Controller,
  Get,
  Body,
  Patch,
  Delete,
  UseGuards,
  Param,
  Query,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { UpdateUserDTO } from "./dto/update-user.dto";
import { FindByEmailDTO } from "./dto/find-by-email.dto";
import { UserId } from "../../common/decorators/user-id.decorator";
import { User } from "../../infra/database/entities/user.entity";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { UserFilterDTO } from "./dto/user-filter.dto";
import { ApiOperation } from "@nestjs/swagger";

@UseGuards(RolesGuard)
@Roles(Role.USER)
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Find all users with filters" })
  findAll(@Query() userFilterDto: UserFilterDTO) {
    return this.userService.findAll(userFilterDto);
  }

  @Get("by-email/:email")
  @ApiOperation({ summary: "Find a user by email" })
  async findUser(@Param() dto: FindByEmailDTO) {
    return await this.userService.findByEmail(dto.email);
  }

  @Get(":id")
  @ApiOperation({ summary: "Find a user by id" })
  async findById(@Param("id") id: number): Promise<User> {
    return await this.userService.findById(id);
  }

  @Patch("update")
  @ApiOperation({ summary: "Update user data" })
  async update(@Body() dto: UpdateUserDTO, @UserId() userId: number) {
    return await this.userService.update(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: "Delete a user" })
  async delete(@UserId() userId: number) {
    return this.userService.deleteUser(userId);
  }
}
