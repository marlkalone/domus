import { IsNumber, IsNotEmpty } from "class-validator";

export class DeleteBillingDTO {
  @IsNumber()
  @IsNotEmpty()
  readonly projectId: number;

  @IsNumber()
  @IsNotEmpty()
  readonly id: number;
}
