import { DataSource } from "typeorm";
import * as bcrypt from "bcrypt";
import { User } from "../entities/user.entity";
import { UserAddress } from "../entities/userAddress.entity";
import { Role, UserType } from "../../../common/enums/user.enum";

export async function seedSuperAdmin(ds: DataSource) {
  const userRepo = ds.getRepository(User);
  const addrRepo = ds.getRepository(UserAddress);

  const email = "superadmin@domus.com";
  const password = "DomusLordAdmin";

  let user = await userRepo.findOne({ where: { email } });

  const passwordHash = await bcrypt.hash(password, 10);

  if (user) {
    user.name = "Super Admin";
    user.passwordHash = passwordHash;
    user.emailVerified = true;
    user.role = Role.SUPER_ADMIN;
    user.version = 0;
    await userRepo.save(user);
  } else {
    user = userRepo.create({
      name: "Super Admin",
      email,
      passwordHash,
      emailVerified: true,
      phone: "",
      document: "",
      type: UserType.ADMIN,
      role: Role.SUPER_ADMIN,
      version: 0,
    });
    user = await userRepo.save(user);
  }

  const existingAddr = await addrRepo.findOne({
    where: { user: { id: user.id } },
  });
  if (!existingAddr) {
    const addr = addrRepo.create({
      zipCode: "00000-000",
      street: "Admin Street",
      number: "1",
      complement: "",
      neighborhood: "Admin Town",
      city: "Admin City",
      state: "AC",
      version: 0,
      user,
    });
    await addrRepo.save(addr);
  }

  console.log(`✅ Super Admin seeded: ${email} / ${password}`);
}
