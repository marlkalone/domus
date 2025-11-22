import { IsNumber, IsOptional, IsNotEmpty } from "class-validator";

export class ReadBillingDTO {
  @IsNumber()
  @IsNotEmpty()
  readonly projectId: number;

  @IsOptional()
  @IsNumber()
  readonly billingId?: number;
}
