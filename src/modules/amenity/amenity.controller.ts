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
import { AmenityService } from "./amenity.service";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { CheckPermission } from "../../common/decorators/check-permission.decorator";
import { CreateAmenityDTO } from "./dto/create-amenity.dto";
import { AmenityFilterDTO } from "./dto/amenity-filter.dto";
import { UpdateAmenityDTO } from "./dto/update-amenity.dto";

@ApiTags("Amenities")
@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("amenities")
export class AmenityController {
  constructor(private readonly service: AmenityService) {}

  @ApiOperation({ summary: "Create an amenity" })
  @Post()
  @CheckPermission("AMENITIES_PER_PROJECT")
  async create(@Body() dto: CreateAmenityDTO, @UserId() userId: number) {
    return this.service.create(userId, dto);
  }

  @ApiOperation({ summary: "Get one amenity" })
  @Get(":id")
  async findOne(
    @UserId() userId: number,
    @Param("amenityId", ParseIntPipe) amenityId: number,
    @Query("projectId", ParseIntPipe) projectId: number,
  ) {
    return this.service.findOne(userId, { projectId, amenityId });
  }

  @ApiOperation({ summary: "List amenity with filters e totals" })
  @Get("items")
  async list(@UserId() userId: number, @Query() filter: AmenityFilterDTO) {
    return this.service.listProjectAmenity(userId, filter);
  }

  @ApiOperation({ summary: "Update an amenity" })
  @Patch(":id")
  async update(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAmenityDTO,
  ) {
    return this.service.update(userId, dto.projectId, id, dto);
  }

  @ApiOperation({ summary: "Delete an amenity" })
  @Delete(":id")
  async remove(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) amenityId: number,
    @Query("projectId", ParseIntPipe) projectId: number,
  ) {
    await this.service.remove({ userId, projectId, amenityId });
  }
}
