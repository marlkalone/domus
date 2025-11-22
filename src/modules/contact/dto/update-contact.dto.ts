import { IsNotEmpty, IsNumber } from "class-validator";
import { CreateContactDTO } from "./create-contact.dto";

export class UpdateContactDTO extends CreateContactDTO {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  version: number;
}
