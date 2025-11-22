import { IsEmail, IsNotEmpty } from "class-validator";

export class FindByEmailDTO {
  @IsNotEmpty()
  @IsEmail({}, { message: "Enter correct email" })
  readonly email: string;
}
