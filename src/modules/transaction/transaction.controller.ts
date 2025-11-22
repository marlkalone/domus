import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Query,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { TransactionService } from "./transaction.service";
import { UpdateTransactionDto } from "./dto/update-transaction.dto";
import { CreateTransactionDTO } from "./dto/create-transaction.dto";
import { DeleteTransactionDTO } from "./dto/delete-transaction.dto";
import { DeleteTaxAssociationDto } from "./dto/delete-tax-association.dto";
import { UserId } from "../../common/decorators/user-id.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { PlanGuard } from "../../common/guards/plan.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/user.enum";
import { CreateSaleTransactionDTO } from "./dto/create-sale-transaction.dto";
import { TransactionFilterQueryDto } from "./dto/transaction-filter-query.dto";
import { PaginationResponse } from "../../common/utils/pagination-response";
import { Transaction } from "../../infra/database/entities/transaction.entity";
import { UpdateScope } from "./dto/update-scope.enum";

@ApiTags("Transaction")
@UseGuards(RolesGuard, PlanGuard)
@Roles(Role.USER)
@Controller("transactions")
export class TransactionController {
  constructor(private readonly svc: TransactionService) {}

  @ApiOperation({ summary: "Create a transaction" })
  @Post()
  create(@Body() dto: CreateTransactionDTO, @UserId() userId: number) {
    return this.svc.create(userId, dto);
  }

  @ApiOperation({ summary: "Create a final sale transaction" })
  @Post("sale")
  createSaleTransaction(
    @Body() dto: CreateSaleTransactionDTO,
    @UserId() userId: number,
  ) {
    return this.svc.createSaleTransaction(
      userId,
      dto.projectId,
      dto.salePrice,
      dto.contactId,
      new Date(dto.saleDate),
    );
  }

  @ApiOperation({ summary: "List all transactions" })
  @Get()
  findAll(
    @UserId() userId: number,
    @Query() filter: TransactionFilterQueryDto,
  ): Promise<PaginationResponse<Transaction>> {
    return this.svc.findAll(userId, filter);
  }

  @ApiOperation({ summary: "Get a single transaction" })
  @Get(":id")
  findOne(
    @Param("id", ParseIntPipe) transactionId: number,
    @Query("projectId", ParseIntPipe) projectId: number,
    @UserId() userId: number,
  ) {
    return this.svc.readOne(userId, projectId, transactionId);
  }

  @ApiOperation({ summary: "Update a transaction" })
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
    @UserId() userId: number,
  ) {
    dto.id = id;
    dto.userId = userId;
    return this.svc.update(dto);
  }

  @ApiOperation({ summary: "Delete a transaction" })
  @Delete(":id")
  delete(
    @Param("id", ParseIntPipe) id: number,
    @Query("projectId", ParseIntPipe) projectId: number,
    @UserId() userId: number,
    @Query("scope") scope: UpdateScope = UpdateScope.ONE,
  ) {
    const dto: DeleteTransactionDTO = { userId, projectId, id, scope };
    return this.svc.delete(dto);
  }

  @ApiOperation({ summary: "Remove a tax association" })
  @Delete("tax/:transactionId/:taxId")
  deleteTax(
    @Param("transactionId", ParseIntPipe) transactionId: number,
    @Param("taxId", ParseIntPipe) taxId: number,
  ) {
    const dto: DeleteTaxAssociationDto = { transactionId, taxId };
    return this.svc.deleteTaxAssociation(dto);
  }
}
