import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import { AcquisitionType } from "../../../common/enums/project.enum";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { AddressDTO } from "../../../common/utils/address.dto";
import { ProjectDetailItemDTO } from "./project-detail-Item.dto";

export class UpdateProjectDTO {
  @IsInt()
  version: number;

  // --- Campos Atualizáveis ---
  @IsEnum(AcquisitionType)
  acquisition_type: AcquisitionType;

  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @IsNumber()
  @Min(0)
  acquisitionPrice: number;

  @IsNumber()
  @Min(0)
  targetSalePrice: number;

  @IsString()
  title: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AddressDTO)
  address: AddressDTO;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProjectDetailItemDTO)
  details?: ProjectDetailItemDTO[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  attachmentKeys?: AttachmentKeyDTO[];
}
