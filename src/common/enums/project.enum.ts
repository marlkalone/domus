export enum ProjectStatus {
  PRE_ACQUISITION = "PRE_ACQUISITION",
  PLANNING = "PLANNING",
  RENOVATION = "RENOVATION",
  LISTED = "LISTED",
  SOLD = "SOLD",
}

export enum ProjectDetailKey {
  ACQUISITION_DATE = "acquisition_date",
  ACQUISITION_VALUE = "acquisition_value",
  MARKET_VALUE = "market_value",
  AREA = "area",
  BEDROOMS = "bedrooms",
  BATHROOMS = "bathrooms",
  LIVING_ROOMS = "living_rooms",
  DESCRIPTION = "description",
  STATUS = "status",
  AMENITIES = "amenities",
}

export enum AcquisitionType {
  PURCHASE = "purchase",
  AUCTION = "auction",
  INHERITANCE = "inheritance",
  SUBLEASE = "sublease",
}
