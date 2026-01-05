import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import {
    LoginCredentials,
    TokenPayload,
    AuthTokens,
    RefreshTokenPayload,
    UserInfo,
} from '../types/auth.types';
import { GeographicAuthorizationService } from './geographic-authorization.service';

export class AuthService {
    private readonly SALT_ROUNDS = 10;
    private readonly ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
    private readonly REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';
    private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    constructor(
        private userRepository: UserRepository,
        private geographicAuthorizationService?: GeographicAuthorizationService
    ) { }

    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    generateAccessToken(payload: TokenPayload): string {
        return jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
    } as jwt.SignOptions);
  }

    generateRefreshToken(payload: RefreshTokenPayload): string {
        return jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.REFRESH_TOKEN_EXPIRY,
    } as jwt.SignOptions);
  }

    verifyToken<T = TokenPayload>(token: string): T {
        return jwt.verify(token, this.JWT_SECRET) as T;
    }

    async login(credentials: LoginCredentials): Promise<AuthTokens> {
        const { email, password } = credentials;

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
          throw new Error('Invalid credentials');
      }

      const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
          throw new Error('Invalid credentials');
      }

        // Get authorization info for JWT token
        let authorizedAreaIds: string[] = [];
        let readOnlyAreaIds: string[] = [];
        let hasGeographicRestrictions = false;

        if (this.geographicAuthorizationService) {
            const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(user.id);
            authorizedAreaIds = authInfo.authorizedAreaIds;
            readOnlyAreaIds = authInfo.readOnlyAreaIds;
            hasGeographicRestrictions = authInfo.hasGeographicRestrictions;
        }

      const accessToken = this.generateAccessToken({
          userId: user.id,
          email: user.email,
          role: user.role,
          authorizedAreaIds,
          readOnlyAreaIds,
          hasGeographicRestrictions,
      });

      const refreshToken = this.generateRefreshToken({
          userId: user.id,
      });

      return {
          accessToken,
          refreshToken,
          user: {
              id: user.id,
              email: user.email,
              role: user.role,
              displayName: user.displayName,
          },
      };
  }

    async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
        try {
        const payload = this.verifyToken<RefreshTokenPayload>(refreshToken);

        const user = await this.userRepository.findById(payload.userId);
        if (!user) {
            throw new Error('User not found');
        }

            // Get authorization info for JWT token
            let authorizedAreaIds: string[] = [];
            let readOnlyAreaIds: string[] = [];
            let hasGeographicRestrictions = false;

            if (this.geographicAuthorizationService) {
                const authInfo = await this.geographicAuthorizationService.getAuthorizationInfo(user.id);
                authorizedAreaIds = authInfo.authorizedAreaIds;
                readOnlyAreaIds = authInfo.readOnlyAreaIds;
                hasGeographicRestrictions = authInfo.hasGeographicRestrictions;
            }

        const newAccessToken = this.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            authorizedAreaIds,
            readOnlyAreaIds,
            hasGeographicRestrictions,
        });

        const newRefreshToken = this.generateRefreshToken({
            userId: user.id,
        });

          return {
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              user: {
                  id: user.id,
                  email: user.email,
                  role: user.role,
                  displayName: user.displayName,
              },
          };
      } catch (error) {
          throw new Error('Invalid refresh token');
      }
  }

    async getUserInfo(userId: string): Promise<UserInfo> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

      return {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
      };
  }

    validateAccessToken(token: string): TokenPayload {
        try {
            return this.verifyToken<TokenPayload>(token);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}
