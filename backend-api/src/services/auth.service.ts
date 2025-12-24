import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import {
    LoginCredentials,
    TokenPayload,
    AuthTokens,
    RefreshTokenPayload,
    UserInfo,
} from '../types/auth.types';

export class AuthService {
    private readonly SALT_ROUNDS = 10;
    private readonly ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m';
    private readonly REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d';
    private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

    constructor(private userRepository: UserRepository) { }

    /**
     * Hash a password using bcrypt
     */
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    /**
     * Verify a password against a hash
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Generate JWT access token
     */
    generateAccessToken(payload: TokenPayload): string {
        return jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
        });
    }

    /**
     * Generate JWT refresh token
     */
    generateRefreshToken(payload: RefreshTokenPayload): string {
        return jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.REFRESH_TOKEN_EXPIRY,
        });
    }

    /**
     * Verify and decode JWT token
     */
    verifyToken<T = TokenPayload>(token: string): T {
        return jwt.verify(token, this.JWT_SECRET) as T;
    }

    /**
     * Authenticate user with email and password
     */
    async login(credentials: LoginCredentials): Promise<AuthTokens> {
        const { email, password } = credentials;

        // Find user by email
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // Generate tokens
        const accessToken = this.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        const refreshToken = this.generateRefreshToken({
            userId: user.id,
        });

        return {
            accessToken,
            refreshToken,
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
        try {
            // Verify refresh token
            const payload = this.verifyToken<RefreshTokenPayload>(refreshToken);

            // Get user from database
            const user = await this.userRepository.findById(payload.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Generate new tokens
            const newAccessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                role: user.role,
            });

            const newRefreshToken = this.generateRefreshToken({
                userId: user.id,
            });

            return {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    /**
     * Get user information by ID
     */
    async getUserInfo(userId: string): Promise<UserInfo> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    /**
     * Validate token and return payload
     */
    validateAccessToken(token: string): TokenPayload {
        try {
            return this.verifyToken<TokenPayload>(token);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }
}
