import { IsEnum, IsString, IsNotEmpty } from "class-validator";
import { ContactDetailKey } from "../../../common/enums/contact.enums";

export class ContactDetailDTO {
  @IsNotEmpty()
  @IsEnum(ContactDetailKey)
  readonly key: ContactDetailKey;

  @IsNotEmpty()
  @IsString()
  readonly value: string;
}
