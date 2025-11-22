import "dotenv/config";
import { DataSource } from "typeorm";
import { join } from "path";

const root = process.cwd();

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: ["warn", "error"],
  entities: [
    join(
      root,
      "src",
      "infra",
      "database",
      "entities",
      "*.{entity,model}.{ts,js}",
    ),
  ],
  migrations: [
    join(root, "src", "infra", "database", "migrations", "*.{ts,js}"),
  ],
  migrationsTableName: "migrations_typeorm",
});
