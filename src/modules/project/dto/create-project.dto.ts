import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsEnum,
  ValidateNested,
  IsOptional,
  Min,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";
import { AttachmentKeyDTO } from "../../../common/utils/attachment-key.dto";
import { AcquisitionType } from "../../../common/enums/project.enum";
import { ProjectStatus } from "../../../common/enums/project.enum";
import { AddressDTO } from "../../../common/utils/address.dto";
import { ProjectDetailItemDTO } from "./project-detail-Item.dto";

export class CreateProjectDTO {
  @IsNotEmpty()
  @IsString()
  readonly title: string;

  @IsEnum(AcquisitionType)
  readonly acquisition_type: AcquisitionType;

  @IsOptional()
  @IsEnum(ProjectStatus)
  readonly status?: ProjectStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  acquisitionPrice?: number; // Preço de compra

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetSalePrice?: number; // Meta de preço de venda

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AddressDTO)
  address: AddressDTO;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectDetailItemDTO)
  details?: ProjectDetailItemDTO[]; // Detalhes (ex: "quartos": "3")

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentKeyDTO)
  readonly attachs: AttachmentKeyDTO[];
}
