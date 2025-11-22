import { MigrationInterface, QueryRunner } from "typeorm";

export class Migrations1763840352931 implements MigrationInterface {
  name = "Migrations1763840352931";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "contact_details" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "value" character varying NOT NULL, "contact_id" integer, CONSTRAINT "PK_a412ff7c8090ce1abc33f128587" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "taxes" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "taxType" character varying NOT NULL, "percentage" numeric(9,2) NOT NULL, "startDate" TIMESTAMP NOT NULL DEFAULT now(), "version" integer NOT NULL, "userId" integer, CONSTRAINT "PK_6c58c9cbb420c4f65e3f5eb8162" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."amenities_condition_enum" AS ENUM('broken', 'poor', 'good', 'excellent')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."amenities_category_enum" AS ENUM('finishing', 'fixed_appliance', 'custom_furniture', 'infrastructure', 'leisure', 'movable_furniture')`,
    );
    await queryRunner.query(
      `CREATE TABLE "amenities" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying NOT NULL, "condition" "public"."amenities_condition_enum" NOT NULL, "category" "public"."amenities_category_enum" NOT NULL, "quantity" integer NOT NULL, "includedInSale" boolean NOT NULL DEFAULT false, "version" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "projectId" integer, CONSTRAINT "PK_c0777308847b3556086f2fb233e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attachments_ownertype_enum" AS ENUM('user', 'contact', 'project', 'amenity', 'task', 'transaction')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attachments" ("id" SERIAL NOT NULL, "ownerType" "public"."attachments_ownertype_enum" NOT NULL, "ownerId" integer NOT NULL, "url" character varying NOT NULL, "originalName" character varying NOT NULL, "mimeType" character varying NOT NULL, "userId" integer, "contactId" integer, "projectId" integer, "amenityId" integer, "taskId" integer, "transactionId" integer, CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('expense', 'revenue')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_recurrence_enum" AS ENUM('recurring', 'one_time')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('to_invoice', 'invoiced')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "category" character varying NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "recurrence" "public"."transactions_recurrence_enum" NOT NULL DEFAULT 'one_time', "paymentDate" TIMESTAMP NOT NULL DEFAULT now(), "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP, "amount" numeric(15,2) NOT NULL, "status" "public"."transactions_status_enum" NOT NULL, "expenseType" character varying, "version" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "parent_id" integer, "projectId" integer, "contactId" integer, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."billings_status_enum" AS ENUM('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "billings" ("id" SERIAL NOT NULL, "description" character varying NOT NULL, "amount" numeric(9,2) NOT NULL, "billingDate" date NOT NULL, "dueDate" date NOT NULL, "paymentDate" date, "status" "public"."billings_status_enum" NOT NULL DEFAULT 'PENDING', "version" integer NOT NULL, "projectId" integer, "contact_id" integer, CONSTRAINT "PK_b4c005480bcc7e02a04880c8b27" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "project_addresses" ("id" SERIAL NOT NULL, "zipCode" character varying NOT NULL, "street" character varying NOT NULL, "number" character varying NOT NULL, "complement" character varying, "neighborhood" character varying NOT NULL, "city" character varying NOT NULL, "state" character varying NOT NULL, CONSTRAINT "PK_58bb94c6e67d76e76d3d7b5696d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "project_details" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "value" character varying NOT NULL, "projectId" integer, CONSTRAINT "PK_0a526dd9b0c2eb6e9d67edd7da4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."projects_status_enum" AS ENUM('PRE_ACQUISITION', 'PLANNING', 'RENOVATION', 'LISTED', 'SOLD')`,
    );
    await queryRunner.query(
      `CREATE TABLE "projects" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "acquisitionType" character varying NOT NULL, "status" "public"."projects_status_enum" NOT NULL DEFAULT 'PRE_ACQUISITION', "acquisitionPrice" numeric(15,2) NOT NULL DEFAULT '0', "targetSalePrice" numeric(15,2) NOT NULL DEFAULT '0', "actualSalePrice" numeric(15,2), "version" integer NOT NULL, "userId" integer, "address_id" integer, CONSTRAINT "REL_4d5093008d8c243ddd0687aeaa" UNIQUE ("address_id"), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "tasks" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL, "deadline" TIMESTAMP NOT NULL, "scheduleTime" character varying, "status" character varying NOT NULL, "version" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "projectId" integer, "contactId" integer, CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."contacts_role_enum" AS ENUM('collaborator', 'provider', 'tenant')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."contacts_contacttype_enum" AS ENUM('INDIVIDUAL', 'COMPANY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "contacts" ("id" SERIAL NOT NULL, "role" "public"."contacts_role_enum" NOT NULL, "contactType" "public"."contacts_contacttype_enum", "name" character varying NOT NULL, "email" character varying, "phone" character varying NOT NULL, "version" integer NOT NULL, "user_id" integer, CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions_catalog" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "description" character varying NOT NULL, "kind" character varying NOT NULL, CONSTRAINT "UQ_5162592a5bf8699a3d82d97f348" UNIQUE ("code"), CONSTRAINT "PK_a790eb25fa6db9b976ab6d14700" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plan_permissions" ("id" SERIAL NOT NULL, "value" character varying, "planId" integer, "permissionId" integer, CONSTRAINT "UQ_plan_permissions_plan_permission" UNIQUE ("planId", "permissionId"), CONSTRAINT "PK_61b666b1e9c1e47013b3ea847fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "price" numeric(15,2) NOT NULL, CONSTRAINT "UQ_95f7ef3fc4c31a3545b4d825dd4" UNIQUE ("code"), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('PENDING', 'ACTIVE', 'PAST_DUE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" SERIAL NOT NULL, "status" "public"."subscriptions_status_enum" NOT NULL, "startDate" TIMESTAMP, "endDate" TIMESTAMP, "stripeSubscriptionId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "planId" integer, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" SERIAL NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_type_enum" AS ENUM('INDIVIDUAL', 'COMPANY', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "emailVerified" boolean NOT NULL DEFAULT false, "phone" character varying, "document" character varying NOT NULL, "type" "public"."users_type_enum" NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "stripeCustomerId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "version" integer NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_addresses" ("id" SERIAL NOT NULL, "zipCode" character varying NOT NULL, "street" character varying NOT NULL, "number" character varying NOT NULL, "complement" character varying, "neighborhood" character varying NOT NULL, "city" character varying NOT NULL, "state" character varying NOT NULL, "version" integer NOT NULL, "user_id" integer, CONSTRAINT "REL_7a5100ce0548ef27a6f1533a5c" UNIQUE ("user_id"), CONSTRAINT "PK_8abbeb5e3239ff7877088ffc25b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'DELETE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" integer NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "action" "public"."logs_action_enum" NOT NULL, "entityName" character varying NOT NULL, "entityId" character varying NOT NULL, "changes" jsonb, CONSTRAINT "PK_fb1b805f2f7795de79fa69340ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a1196a1956403417fe3a034339" ON "logs" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e51178ec92aeb69e253ed04a20" ON "logs" ("entityName") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a90e8fe7ea15f472f12f3bee2" ON "logs" ("entityId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "transaction_taxes" ("transaction_id" integer NOT NULL, "tax_id" integer NOT NULL, CONSTRAINT "PK_54d26d37cedf2543a650499a7ab" PRIMARY KEY ("transaction_id", "tax_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d21db1756c6656efc7c082fbaa" ON "transaction_taxes" ("transaction_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5ca3ffcf1422df09e322e48954" ON "transaction_taxes" ("tax_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_details" ADD CONSTRAINT "FK_709467f1ced19e6b9eea5affc7c" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "taxes" ADD CONSTRAINT "FK_82bedd7bac2b6bce4fd793fd85f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "amenities" ADD CONSTRAINT "FK_e26aad938a0d5a1665265a0f10f" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_35138b11d46d53c48ed932afa47" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_7ea61474109abbc16be4c27217f" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_9f84e7261b527273134325522e1" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_ceeef718fab38aa23e38d049a0c" FOREIGN KEY ("amenityId") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_65152e15d915ebe1294160bd1d3" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" ADD CONSTRAINT "FK_87463b4a696a5b52a398afd9282" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_413e95171729ba18cabce1c31e3" FOREIGN KEY ("parent_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_92d1d5070de965ff398a522b4ff" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_4411883dd09243706ee3483caa1" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "billings" ADD CONSTRAINT "FK_6b146ad029ae8a699c454d20580" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "billings" ADD CONSTRAINT "FK_37fb527552d9d46bcd59bbe6dc8" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_details" ADD CONSTRAINT "FK_2ece29a12e80f14a738727bb565" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_361a53ae58ef7034adc3c06f09f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_4d5093008d8c243ddd0687aeaaf" FOREIGN KEY ("address_id") REFERENCES "project_addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_e08fca67ca8966e6b9914bf2956" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_22e88bf5fa06f3df4f4edb1493f" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contacts" ADD CONSTRAINT "FK_af0a71ac1879b584f255c49c99a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_permissions" ADD CONSTRAINT "FK_92bec4f104c39b12abba3e6bbe7" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_permissions" ADD CONSTRAINT "FK_1f42a842c246e17af3fbcbb24ea" FOREIGN KEY ("permissionId") REFERENCES "permissions_catalog"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_7536cba909dd7584a4640cad7d5" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_addresses" ADD CONSTRAINT "FK_7a5100ce0548ef27a6f1533a5ce" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_taxes" ADD CONSTRAINT "FK_d21db1756c6656efc7c082fbaa6" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_taxes" ADD CONSTRAINT "FK_5ca3ffcf1422df09e322e489545" FOREIGN KEY ("tax_id") REFERENCES "taxes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_taxes" DROP CONSTRAINT "FK_5ca3ffcf1422df09e322e489545"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_taxes" DROP CONSTRAINT "FK_d21db1756c6656efc7c082fbaa6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_addresses" DROP CONSTRAINT "FK_7a5100ce0548ef27a6f1533a5ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_7536cba909dd7584a4640cad7d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_permissions" DROP CONSTRAINT "FK_1f42a842c246e17af3fbcbb24ea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "plan_permissions" DROP CONSTRAINT "FK_92bec4f104c39b12abba3e6bbe7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contacts" DROP CONSTRAINT "FK_af0a71ac1879b584f255c49c99a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_22e88bf5fa06f3df4f4edb1493f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_e08fca67ca8966e6b9914bf2956"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_4d5093008d8c243ddd0687aeaaf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_361a53ae58ef7034adc3c06f09f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_details" DROP CONSTRAINT "FK_2ece29a12e80f14a738727bb565"`,
    );
    await queryRunner.query(
      `ALTER TABLE "billings" DROP CONSTRAINT "FK_37fb527552d9d46bcd59bbe6dc8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "billings" DROP CONSTRAINT "FK_6b146ad029ae8a699c454d20580"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_4411883dd09243706ee3483caa1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_92d1d5070de965ff398a522b4ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_413e95171729ba18cabce1c31e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_87463b4a696a5b52a398afd9282"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_65152e15d915ebe1294160bd1d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_ceeef718fab38aa23e38d049a0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_9f84e7261b527273134325522e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_7ea61474109abbc16be4c27217f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attachments" DROP CONSTRAINT "FK_35138b11d46d53c48ed932afa47"`,
    );
    await queryRunner.query(
      `ALTER TABLE "amenities" DROP CONSTRAINT "FK_e26aad938a0d5a1665265a0f10f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "taxes" DROP CONSTRAINT "FK_82bedd7bac2b6bce4fd793fd85f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_details" DROP CONSTRAINT "FK_709467f1ced19e6b9eea5affc7c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5ca3ffcf1422df09e322e48954"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d21db1756c6656efc7c082fbaa"`,
    );
    await queryRunner.query(`DROP TABLE "transaction_taxes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a90e8fe7ea15f472f12f3bee2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e51178ec92aeb69e253ed04a20"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a1196a1956403417fe3a034339"`,
    );
    await queryRunner.query(`DROP TABLE "logs"`);
    await queryRunner.query(`DROP TYPE "public"."logs_action_enum"`);
    await queryRunner.query(`DROP TABLE "user_addresses"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_type_enum"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
    await queryRunner.query(`DROP TABLE "plans"`);
    await queryRunner.query(`DROP TABLE "plan_permissions"`);
    await queryRunner.query(`DROP TABLE "permissions_catalog"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
    await queryRunner.query(`DROP TYPE "public"."contacts_contacttype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."contacts_role_enum"`);
    await queryRunner.query(`DROP TABLE "tasks"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
    await queryRunner.query(`DROP TABLE "project_details"`);
    await queryRunner.query(`DROP TABLE "project_addresses"`);
    await queryRunner.query(`DROP TABLE "billings"`);
    await queryRunner.query(`DROP TYPE "public"."billings_status_enum"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."transactions_recurrence_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
    await queryRunner.query(`DROP TYPE "public"."attachments_ownertype_enum"`);
    await queryRunner.query(`DROP TABLE "amenities"`);
    await queryRunner.query(`DROP TYPE "public"."amenities_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."amenities_condition_enum"`);
    await queryRunner.query(`DROP TABLE "taxes"`);
    await queryRunner.query(`DROP TABLE "contact_details"`);
  }
}
