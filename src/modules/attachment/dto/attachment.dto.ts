import {
  IsEnum,
  IsInt,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";
import { AttachmentOwnerType } from "../../../common/enums/subscription.enum";

class FileMeta {
  @IsString()
  originalName: string;

  @IsString()
  mimeType: string;
}

export class PresignAttachmentDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FileMeta)
  files: FileMeta[];
}
