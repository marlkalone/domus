import { IsNotEmpty, IsString, IsOptional } from "class-validator";
export class AddressDTO {
  @IsNotEmpty()
  @IsString()
  readonly zipCode: string;

  @IsNotEmpty()
  @IsString()
  readonly street: string;

  @IsNotEmpty()
  @IsString()
  readonly number: string;

  @IsNotEmpty()
  @IsString()
  readonly neighborhood: string;

  @IsNotEmpty()
  @IsString()
  readonly city: string;

  @IsNotEmpty()
  @IsString()
  readonly state: string;

  @IsOptional()
  @IsString()
  readonly complement?: string;
}
