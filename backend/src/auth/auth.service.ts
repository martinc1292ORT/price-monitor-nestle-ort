import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive)
      throw new UnauthorizedException('Credenciales inválidas');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException('Credenciales inválidas');

    await this.users.updateLastLogin(user.id);

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refresh(userId: number, refreshToken: string) {
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId, token: refreshToken },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored)
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new ForbiddenException('Refresh token inválido o expirado');
    }

    const user = await this.users.findById(userId);
    if (!user || !user.isActive) throw new UnauthorizedException();

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: number, refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token: refreshToken },
    });
  }

  private async generateTokens(userId: number, email: string, role: string) {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessExpires = this.toExpiresInSeconds(
      this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    );
    const refreshExpires = this.toExpiresInSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: accessExpires }),
      this.jwt.signAsync(payload, { expiresIn: refreshExpires }),
    ]);

    return { accessToken, refreshToken };
  }

  private toExpiresInSeconds(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 900;
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return parseInt(match[1], 10) * (multipliers[match[2]] ?? 60);
  }

  private async saveRefreshToken(userId: number, token: string) {
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES', '7d');
    const days = parseInt(refreshExpires.replace('d', ''), 10);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }
}
