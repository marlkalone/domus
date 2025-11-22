import { ProjectDetailKey, ProjectStatus } from "../enums/project.enum";

export function isProjectDetailValid(detail: {
  key: string;
  value: string;
}): boolean {
  const { key, value } = detail;

  switch (key) {
    case ProjectDetailKey.ACQUISITION_DATE:
      return !isNaN(Date.parse(value));

    case ProjectDetailKey.ACQUISITION_VALUE:
    case ProjectDetailKey.MARKET_VALUE:
    case ProjectDetailKey.AREA:
    case ProjectDetailKey.BEDROOMS:
    case ProjectDetailKey.BATHROOMS:
    case ProjectDetailKey.LIVING_ROOMS:
      return !isNaN(Number(value));

    case ProjectDetailKey.DESCRIPTION:
      return value.trim().length > 0;

    case ProjectDetailKey.STATUS:
      return Object.values(ProjectStatus).includes(value as ProjectStatus);

    default:
      return false;
  }
}
