import { BadRequestException } from "@nestjs/common";
import { TransactionType } from "../../../common/enums/transaction.enum";

export class PeriodValidator {
  static validateDates(type: TransactionType, start: Date, end?: Date): void {
    if (type === TransactionType.REVENUE && end && start > end) {
      throw new BadRequestException("Start date cannot be after end date.");
    }
  }
}
