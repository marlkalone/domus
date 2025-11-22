import { MigrationInterface, QueryRunner } from "typeorm";
import * as bcrypt from "bcrypt";

export class SeedInitialData1763840352931 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Seed plans
    await queryRunner.query(`
      INSERT INTO plans(code, name, price)
      VALUES
        ('FREE',    'Free',    0.00),
        ('STARTER', 'Starter', 29.90),
        ('BASIC',   'Basic',   59.90),
        ('PRO',     'Pro',     99.90)
      ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            price = EXCLUDED.price;
    `);

    // 2) Seed permission catalog
    await queryRunner.query(`
      INSERT INTO permissions_catalog(code, description, kind)
      VALUES
        ('PROJECT_MAX_COUNT',            'Maximum number of projects',                          'number'),
        ('PROJECT_PHOTO_LIMIT',          'Maximum photos per project',                          'number'),
        ('PROJECT_VIDEO_LIMIT',          'Maximum videos (≤1 min) per project',                 'number'),
        ('AMENITIES_PER_PROJECT',        'Maximum inventory items per project',                 'number'),
        ('AMENITY_ATTACH_PER_ITEM',      'Maximum attachments per amenity',                     'number'),
        ('CONTACT_MAX_COUNT',            'Maximum number of contacts',                          'number'),
        ('TASK_ACTIVE_LIMIT',            'Maximum simultaneous active tasks',                   'number'),
        ('TX_MONTHLY_LIMIT',             'Maximum transactions per month',                      'number'),
        ('TAX_ENABLED',                  'Access to Tax module',                                'boolean'),
        ('ATTACH_TOTAL_COUNT',           'Total number of attachments',                         'number')
      ON CONFLICT (code) DO UPDATE
        SET description = EXCLUDED.description,
            kind        = EXCLUDED.kind;
    `);

    // 3) Seed plan_permissions pivot
    //    We assume there is a UNIQUE(plan_id, permission_catalog_id) constraint
    await queryRunner.query(`
      INSERT INTO plan_permissions("planId", "permissionId", "value")
      SELECT
        p.id,
        pc.id,
        CASE p.code
          WHEN 'FREE'    THEN '0'
          WHEN 'STARTER' THEN
            CASE pc.code
              WHEN 'PROJECT_MAX_COUNT'           THEN '2'
              WHEN 'PROJECT_PHOTO_LIMIT'         THEN '10'
              WHEN 'PROJECT_VIDEO_LIMIT'         THEN '2'
              WHEN 'AMENITIES_PER_PROJECT' THEN '10'
              WHEN 'AMENITY_ATTACH_PER_ITEM'    THEN '5'
              WHEN 'CONTACT_MAX_COUNT'            THEN '10'
              WHEN 'TASK_ACTIVE_LIMIT'            THEN '5'
              WHEN 'TX_MONTHLY_LIMIT'             THEN '20'
              WHEN 'TAX_ENABLED'                  THEN '1'
              WHEN 'ATTACH_TOTAL_COUNT'           THEN '200'
              ELSE NULL
            END
          WHEN 'BASIC'  THEN
            CASE pc.code
              WHEN 'PROJECT_MAX_COUNT'            THEN '5'
              WHEN 'PROJECT_PHOTO_LIMIT'          THEN '20'
              WHEN 'PROJECT_VIDEO_LIMIT'          THEN '5'
              WHEN 'AMENITIES_PER_PROJECT'        THEN '20'
              WHEN 'AMENITY_ATTACH_PER_ITEM'      THEN '10'
              WHEN 'CONTACT_MAX_COUNT'            THEN '50'
              WHEN 'TASK_ACTIVE_LIMIT'            THEN '20'
              WHEN 'TX_MONTHLY_LIMIT'             THEN '50'
              WHEN 'TAX_ENABLED'                  THEN '1'
              WHEN 'ATTACH_TOTAL_COUNT'           THEN '2000'
              ELSE NULL
            END
          WHEN 'PRO'    THEN
            CASE pc.code
              WHEN 'PROJECT_MAX_COUNT'            THEN '15'
              WHEN 'PROJECT_PHOTO_LIMIT'          THEN '50'
              WHEN 'PROJECT_VIDEO_LIMIT'          THEN '10'
              WHEN 'AMENITIES_PER_PROJECT'        THEN '50'
              WHEN 'AMENITY_ATTACH_PER_ITEM'      THEN '20'
              WHEN 'TAX_ENABLED'                  THEN '1'
              WHEN 'ATTACH_TOTAL_COUNT'           THEN '10000'
              ELSE NULL
            END
          ELSE NULL
        END
      FROM plans p
      CROSS JOIN permissions_catalog pc
      ON CONFLICT ("planId","permissionId") DO NOTHING;
    `);

    // 4) Seed super-admin user
    const rawPassword = "ChangeMe123!";
    const hash = await bcrypt.hash(rawPassword, 10);

    await queryRunner.query(`
      INSERT INTO users(
        name, "email", "passwordHash", "emailVerified", phone, document, type, role, version
      ) VALUES (
        'Super Admin',
        'superadmin@domus.com',
        '${hash}',
        true,
        '',
        '',
        'ADMIN',       
        'SUPER_ADMIN',
        0
      )
      ON CONFLICT ("email") DO UPDATE
        SET name            = EXCLUDED.name,
            "passwordHash"  = EXCLUDED."passwordHash",
            "emailVerified" = EXCLUDED."emailVerified",
            type            = EXCLUDED.type,
            role            = EXCLUDED.role,
            version         = EXCLUDED.version;
    `);

    // 5) Seed super-admin address
    await queryRunner.query(`
      INSERT INTO user_addresses(
        "zipCode","street","number","complement","neighborhood","city","state",version,user_id
      )
      VALUES (
        '00000-000','Admin Street','1','','Admin Town','Admin City','AC',0,
        (SELECT id FROM users WHERE "email" = 'superadmin@domus.com')
      )
      ON CONFLICT (user_id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // optional: you can choose to DELETE the seeded rows here
    await queryRunner.query(
      `DELETE FROM user_addresses WHERE user_id = (SELECT id FROM users WHERE email = 'superadmin@domus.com')`,
    );
    await queryRunner.query(
      `DELETE FROM users WHERE email = 'superadmin@domus.com'`,
    );
    await queryRunner.query(`DELETE FROM plan_permissions`);
    await queryRunner.query(`DELETE FROM permissions_catalog WHERE code IN (
      'PROJECT_MAX_COUNT','PROJECT_PHOTO_LIMIT','PROJECT_VIDEO_LIMIT',
      'AMENITIES_PER_PROJECT','AMENITY_ATTACH_PER_ITEM',
      'CONTACT_MAX_COUNT','TASK_ACTIVE_LIMIT','TX_MONTHLY_LIMIT',
      'TAX_ENABLED','ATTACH_TOTAL_COUNT'
    )`);
    await queryRunner.query(
      `DELETE FROM plans WHERE code IN ('FREE','STARTER','BASIC','PRO')`,
    );
  }
}
