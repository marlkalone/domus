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
import { BillingService } from "./billing.service";
import { CreateBillingDTO } from "./dto/create-billing.dto";
import { UpdateBillingDTO } from "./dto/update-billing.dto";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { MarkAsPaidDTO } from "./dto/mark-as-paid.dto";
import { BillingFilterDTO } from "./dto/billing-filter.dto";

@ApiTags("Billings")
@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("billings")
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @ApiOperation({ summary: "Create a new billing record" })
  @Post()
  async create(@Body() dto: CreateBillingDTO, @UserId() userId: number) {
    return this.service.create(userId, dto);
  }

  @ApiOperation({ summary: "List billing records for a ptojrvy" })
  @Get()
  async findAll(@UserId() userId: number, @Query() filter: BillingFilterDTO) {
    return this.service.findAll(userId, filter);
  }

  @ApiOperation({ summary: "Get one billing record" })
  @Get(":id")
  async findOne(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Query("projectId", ParseIntPipe) projectId: number,
  ) {
    return this.service.read(userId, { projectId, billingId: id });
  }

  @ApiOperation({ summary: "Update a billing record" })
  @Patch(":id")
  async update(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateBillingDTO,
  ) {
    dto.id = id;
    return this.service.update(userId, dto);
  }

  @ApiOperation({ summary: "Delete a billing record" })
  @Delete(":id")
  async remove(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Query("projectId", ParseIntPipe) projectId: number,
  ) {
    await this.service.remove(userId, { projectId, id });
  }

  @ApiOperation({
    summary: "Mark a billing record as paid and create the expense",
  })
  @Patch(":id/pay")
  async markAsPaid(
    @UserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: MarkAsPaidDTO,
  ) {
    return this.service.markAsPaid(userId, id, dto.paymentDate);
  }
}
