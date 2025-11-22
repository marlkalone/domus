import { DataSource, DeepPartial } from "typeorm";
import { Plan } from "../entities/plan.entity";
import { PermissionCatalog } from "../entities/permission-catalog.entity";
import { PlanPermission } from "../entities/plan-permission.entity";

export async function seedPlanPermissions(ds: DataSource) {
  const planRepo = ds.getRepository(Plan);
  const permCatRepo = ds.getRepository(PermissionCatalog);
  const ppRepo = ds.getRepository(PlanPermission);

  // 1) Fetch plans
  const plans = await planRepo.find();

  // 2) Upsert catalog
  const catalogData: DeepPartial<PermissionCatalog>[] = [
    {
      code: "PROJECT_MAX_COUNT",
      description: "Maximum number of project",
      kind: "number",
    },
    {
      code: "PROJECT_PHOTO_LIMIT",
      description: "Maximum photos per project",
      kind: "number",
    },
    {
      code: "PROJECT_VIDEO_LIMIT",
      description: "Maximum videos (≤1 min) per project",
      kind: "number",
    },
    {
      code: "AMENITIES_PER_PROJECT",
      description: "Maximum inventory items per project",
      kind: "number",
    },
    {
      code: "AMENITY_ATTACH_PER_ITEM",
      description: "Maximum attachments per inventory item",
      kind: "number",
    },
    {
      code: "CONTACT_MAX_COUNT",
      description: "Maximum number of contacts",
      kind: "number",
    },
    {
      code: "TASK_ACTIVE_LIMIT",
      description: "Maximum simultaneous active tasks",
      kind: "number",
    },
    {
      code: "TX_MONTHLY_LIMIT",
      description: "Maximum transactions per month",
      kind: "number",
    },
    {
      code: "TAX_ENABLED",
      description: "Access to Tax module",
      kind: "boolean",
    },
    {
      code: "ATTACH_TOTAL_COUNT",
      description: "Total number of attachments",
      kind: "number",
    },
    {
      code: "API_KEY_COUNT",
      description: "Number of active API keys",
      kind: "number",
    },
    {
      code: "REPORT_LEVEL",
      description: "Reporting level (0=none,1=CSV,2=PDF,3=XLSX)",
      kind: "number",
    },
    {
      code: "ACCOUNT_MEMBER_LIMIT",
      description: "Number of additional account members",
      kind: "number",
    },
    {
      code: "SUPPORT_TIER",
      description: "Support tier (0=community,1=email,2=chat,3=priority)",
      kind: "number",
    },
  ];

  const catalog = permCatRepo.create(catalogData);
  await permCatRepo.save(catalog);

  // 3) Define matrix of values
  const matrix: Record<string, Record<string, string | null>> = {
    FREE: {
      PROJECT_MAX_COUNT: "0",
      PROJECT_PHOTO_LIMIT: "0",
      PROJECT_VIDEO_LIMIT: "0",
      AMENITIES_PER_PROJECT: "0",
      AMENITY_ATTACH_PER_ITEM: "0",
      CONTACT_MAX_COUNT: "0",
      TASK_ACTIVE_LIMIT: "0",
      TX_MONTHLY_LIMIT: "0",
      TAX_ENABLED: "0",
      ATTACH_TOTAL_COUNT: "0",
      API_KEY_COUNT: "0",
      REPORT_LEVEL: "0",
      ACCOUNT_MEMBER_LIMIT: "1",
      SUPPORT_TIER: "0",
    },
    STARTER: {
      PROJECT_MAX_COUNT: "2",
      PROJECT_PHOTO_LIMIT: "10",
      PROJECT_VIDEO_LIMIT: "2",
      AMENITIES_PER_PROJECT: "10",
      AMENITY_ATTACH_PER_ITEM: "5",
      CONTACT_MAX_COUNT: "20",
      TASK_ACTIVE_LIMIT: "5",
      TX_MONTHLY_LIMIT: "20",
      TAX_ENABLED: "1",
      ATTACH_TOTAL_COUNT: "200",
      API_KEY_COUNT: "1",
      REPORT_LEVEL: "1",
      ACCOUNT_MEMBER_LIMIT: "3",
      SUPPORT_TIER: "1",
    },
    BASIC: {
      PROJECT_MAX_COUNT: "5",
      PROJECT_PHOTO_LIMIT: "20",
      PROJECT_VIDEO_LIMIT: "5",
      AMENITIES_PER_PROJECT: "20",
      AMENITY_ATTACH_PER_ITEM: "10",
      CONTACT_MAX_COUNT: "50",
      TASK_ACTIVE_LIMIT: "20",
      TX_MONTHLY_LIMIT: "50",
      TAX_ENABLED: "1",
      ATTACH_TOTAL_COUNT: "2000",
      API_KEY_COUNT: "3",
      REPORT_LEVEL: "2",
      ACCOUNT_MEMBER_LIMIT: "10",
      SUPPORT_TIER: "2",
    },
    PRO: {
      PROJECT_MAX_COUNT: "15",
      PROJECT_PHOTO_LIMIT: "50",
      PROJECT_VIDEO_LIMIT: "10",
      AMENITIES_PER_PROJECT: "50",
      AMENITY_ATTACH_PER_ITEM: "20",
      CONTACT_MAX_COUNT: null,
      TASK_ACTIVE_LIMIT: null,
      TX_MONTHLY_LIMIT: null,
      TAX_ENABLED: "1",
      ATTACH_TOTAL_COUNT: "10000",
      API_KEY_COUNT: "10",
      REPORT_LEVEL: "3",
      ACCOUNT_MEMBER_LIMIT: "25",
      SUPPORT_TIER: "3",
    },
  };

  // 4) Create plan_permissions
  for (const plan of plans) {
    for (const perm of catalog) {
      const val = matrix[plan.name.toUpperCase()]![perm.code] ?? null;
      const pp = ppRepo.create({ plan, permission: perm, value: val });
      await ppRepo.save(pp);
    }
  }
}
