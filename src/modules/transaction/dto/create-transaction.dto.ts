import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsInt,
  IsString,
  IsDateString,
  Min,
  IsArray,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import {
  ExpenseCategory,
  PeriodicityType,
  TransactionStatus,
  TransactionType,
} from "../../../common/enums/transaction.enum";

export class CreateTransactionDTO {
  @IsInt()
  projectId: number;

  @IsInt()
  contactId: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  title: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  category: string;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsNotEmpty()
  @IsEnum(PeriodicityType)
  recurrence: PeriodicityType;

  @IsNotEmpty()
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
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  taxIds?: number[]; // Impostos associados
}
