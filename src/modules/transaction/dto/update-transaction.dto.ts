import { PartialType } from "@nestjs/mapped-types";
import { CreateTransactionDTO } from "./create-transaction.dto";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  ExpenseCategory,
  TransactionStatus,
} from "../../../common/enums/transaction.enum";
import { Type } from "class-transformer";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import { UpdateScope } from "./update-scope.enum";

export class UpdateTransactionDto extends PartialType(CreateTransactionDTO) {
  @IsInt()
  id: number;

  @IsInt()
  version: number;

  @IsInt()
  userId: number;

  @IsInt()
  projectId: number;

  // --- Campos Atualizáveis ---
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  title: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  category: string;

  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  startDate: string | Date;

  @IsOptional()
  @IsDateString()
  endDate?: string | Date;

  @IsOptional()
  @IsDateString()
  paymentDate?: string | Date;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  expenseType?: ExpenseCategory;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  taxIds?: number[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];

  @IsEnum(UpdateScope)
  @IsOptional()
  scope: UpdateScope = UpdateScope.ONE;

  @IsOptional()
  @IsInt()
  rootVersion?: number;
}
