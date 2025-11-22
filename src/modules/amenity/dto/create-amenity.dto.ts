import {
  IsNumber,
  IsString,
  IsEnum,
  ValidateNested,
  IsOptional,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import {
  AmenityCategory,
  AmenityCondition,
} from "../../../common/enums/amenity.enum";

export class CreateAmenityDTO {
  @IsNumber()
  projectId: number;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(AmenityCondition)
  condition: AmenityCondition;

  @IsEnum(AmenityCategory)
  category: AmenityCategory;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsBoolean()
  includedInSale?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];
}
