import { Amenity } from "../../../infra/database/entities/amenity.entity";
import { AmenityCategory } from "../../../common/enums/amenity.enum";

export class ListProjectAmenityDTO {
  data: Amenity[];
  total: number;
  page: number;
  limit: number;
  totalCount: number;
  totalByCategory: Record<AmenityCategory, number>;
}
