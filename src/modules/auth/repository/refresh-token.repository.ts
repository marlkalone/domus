import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import * as bcrypt from "bcrypt";
import { RefreshToken } from "../../../infra/database/entities/refresh-token.entity";

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async createToken(user: any, token: string, expiresAt: Date) {
    const rt = this.repo.create({ user, tokenHash: token, expiresAt });
    return this.repo.save(rt);
  }

  async findValidByUser(userId: number) {
    return this.repo.find({
      where: {
        user: { id: userId },
        expiresAt: MoreThan(new Date()),
      },
      relations: ["user"],
    });
  }

  async remove(tokenEntity: RefreshToken) {
    return this.repo.remove(tokenEntity);
  }

  async removeByToken(userId: number, token: string) {
    const tokens = await this.findValidByUser(userId);

    const matches = await Promise.all(
      tokens.map(async (t) => {
        const isMatch = await bcrypt.compare(token, t.tokenHash);
        return isMatch ? t : null;
      }),
    );

    const match = matches.find((t) => t !== null);

    if (match) {
      await this.repo.remove(match);
    }
  }

  async removeAllByUser(userId: number) {
    return this.repo.delete({ user: { id: userId } });
  }
}
