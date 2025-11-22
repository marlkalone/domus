import { IsDateString } from "class-validator";

export class MarkAsPaidDTO {
  @IsDateString()
  readonly paymentDate: Date;
}
