import { IsEnum, IsInt } from "class-validator";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";

export class UploadAttachmentDto {
  @IsEnum(AttachmentOwnerType)
  ownerType: AttachmentOwnerType;

  @IsInt()
  ownerId: number;
}
