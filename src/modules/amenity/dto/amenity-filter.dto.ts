import { IsOptional, IsEnum, IsString, IsInt } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDTO } from "../../../common/utils/pagination-query.dto";
import {
  AmenityCategory,
  AmenityCondition,
} from "../../../common/enums/amenity.enum";

export class AmenityFilterDTO extends PaginationQueryDTO {
  @IsInt()
  @Type(() => Number)
  projectId: number;

  @IsOptional()
  @IsEnum(AmenityCategory)
  category?: AmenityCategory;

  @IsOptional()
  @IsEnum(AmenityCondition)
  condition?: AmenityCondition;

  @IsOptional()
  @IsString()
  name?: string;
}
