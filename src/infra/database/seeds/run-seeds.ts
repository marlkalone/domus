import { seedPlans } from "./plans.seed";
import { seedSuperAdmin } from "./super-admin.seed";
import { seedPlanPermissions } from "./plan-permissions.seed";
import AppDataSource from "../data-source";

export async function runSeeds() {
  const ds = await AppDataSource.initialize();

  try {
    await seedPlans(ds);
    await seedPlanPermissions(ds);
    await seedSuperAdmin(ds);
    console.log("✅ All seeds have been executed successfully.");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    await ds.destroy();
  }
}

runSeeds();
