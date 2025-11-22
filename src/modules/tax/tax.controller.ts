import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { UserId } from "../../common/decorators/user-id.decorator";
import { TaxService } from "./tax.service";
import { CreateTaxDTO } from "./dto/create-tax.dto";
import { UpdateTaxDTO } from "./dto/update-tax.dto";
import { AssignTaxDTO } from "./dto/assign-tax.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { Role } from "../../common/enums/user.enum";
import { CheckPermission } from "../../common/decorators/check-permission.decorator";
import { TaxFilterDTO } from "./dto/tax-filter.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { Tax } from "../../infra/database/entities/tax.entity";

@ApiTags("Tax")
@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@CheckPermission("TAX_ENABLED")
@Controller("tax")
export class TaxController {
  constructor(private readonly service: TaxService) {}

  @ApiOperation({ summary: "Create a new tax" })
  @Post()
  async create(@Body() dto: CreateTaxDTO, @UserId() user_id: number) {
    return this.service.create(user_id, dto);
  }

  @ApiOperation({ summary: "List all taxes for the user" })
  @Get()
  async findAll(
    @UserId() userId: number,
    @Query() filter: TaxFilterDTO,
  ): Promise<PaginationResponse<Tax>> {
    return this.service.findAll(userId, filter);
  }

  @ApiOperation({ summary: "Get one tax by ID" })
  @Get(":id")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @UserId() user_id: number,
  ) {
    return this.service.findOne(user_id, id);
  }

  @ApiOperation({ summary: "Update a tax" })
  @Patch(":id")
  async update(@UserId() user_id: number, @Body() dto: UpdateTaxDTO) {
    return this.service.update(user_id, dto);
  }

  @ApiOperation({ summary: "Delete a tax" })
  @Delete(":id")
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @UserId() user_id: number,
  ) {
    await this.service.remove({ id, user_id });
  }

  @ApiOperation({ summary: "Assign a tax to an income transaction" })
  @Post(":id/transactions")
  async assign(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignTaxDTO,
  ) {
    return this.service.attachToTransaction(dto.transactionId, [id]);
  }
}
