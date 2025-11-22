import { IsNumber, IsISO8601, IsNotEmpty } from "class-validator";

export class CreateBillingDTO {
  @IsNumber()
  @IsNotEmpty()
  readonly projectId: number;

  @IsISO8601()
  @IsNotEmpty()
  readonly billingDate: string;

  @IsNumber()
  @IsNotEmpty()
  readonly amount: number;
}
