import { PrismaClient, UserRole } from '@prisma/client';
import { UserService } from '../../services/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import bcrypt from 'bcrypt';

describe('User Profile Management Integration Tests', () => {
  let prisma: PrismaClient;
  let userService: UserService;
  const testSuffix = Date.now();
  let testUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const userRepository = new UserRepository(prisma);
    const authorizationRepository = new UserGeographicAuthorizationRepository(prisma);
    userService = new UserService(userRepository, authorizationRepository, prisma);

    // Create a test user
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const testUser = await prisma.user.create({
      data: {
        displayName: 'Test User',
        email: `test-profile-${testSuffix}@example.com`,
        passwordHash: hashedPassword,
        role: UserRole.EDITOR,
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  describe('getCurrentUserProfile', () => {
    it('should return user profile without password hash', async () => {
      const profile = await userService.getCurrentUserProfile(testUserId);

      expect(profile.id).toBe(testUserId);
      expect(profile.displayName).toBe('Test User');
      expect(profile.email).toContain('test-profile-');
      expect(profile.role).toBe(UserRole.EDITOR);
      expect((profile as any).passwordHash).toBeUndefined();
    });

    it('should throw error when user not found', async () => {
      await expect(
        userService.getCurrentUserProfile('non-existent-id')
      ).rejects.toThrow('User not found');
    });
  });

  describe('updateCurrentUserProfile', () => {
    it('should update display name', async () => {
      const updated = await userService.updateCurrentUserProfile(testUserId, {
        displayName: 'Updated Name',
      });

      expect(updated.displayName).toBe('Updated Name');
      expect((updated as any).passwordHash).toBeUndefined();

      // Verify in database
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.displayName).toBe('Updated Name');
    });

    it('should clear display name when set to null', async () => {
      const updated = await userService.updateCurrentUserProfile(testUserId, {
        displayName: null,
      });

      expect(updated.displayName).toBeNull();

      // Verify in database
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.displayName).toBeNull();

      // Restore for other tests
      await userService.updateCurrentUserProfile(testUserId, {
        displayName: 'Test User',
      });
    });

    it('should update password with valid current password', async () => {
      const updated = await userService.updateCurrentUserProfile(testUserId, {
        currentPassword: 'testpassword123',
        newPassword: 'newpassword456',
      });

      expect((updated as any).passwordHash).toBeUndefined();

      // Verify new password works
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      const isValid = await bcrypt.compare('newpassword456', user!.passwordHash);
      expect(isValid).toBe(true);

      // Restore original password for other tests
      const restoredHash = await bcrypt.hash('testpassword123', 10);
      await prisma.user.update({
        where: { id: testUserId },
        data: { passwordHash: restoredHash },
      });
    });

    it('should throw error when current password is incorrect', async () => {
      await expect(
        userService.updateCurrentUserProfile(testUserId, {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
        })
      ).rejects.toThrow('Current password is incorrect');

      // Verify error has correct code
      try {
        await userService.updateCurrentUserProfile(testUserId, {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456',
        });
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CURRENT_PASSWORD');
      }
    });

    it('should throw error when newPassword provided without currentPassword', async () => {
      await expect(
        userService.updateCurrentUserProfile(testUserId, {
          newPassword: 'newpassword456',
        })
      ).rejects.toThrow('Current password is required when changing password');

      // Verify error has correct code
      try {
        await userService.updateCurrentUserProfile(testUserId, {
          newPassword: 'newpassword456',
        });
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CURRENT_PASSWORD');
      }
    });

    it('should throw error when new password is too short', async () => {
      await expect(
        userService.updateCurrentUserProfile(testUserId, {
          currentPassword: 'testpassword123',
          newPassword: 'short',
        })
      ).rejects.toThrow('New password must be at least 8 characters');
    });

    it('should update display name and password together', async () => {
      const updated = await userService.updateCurrentUserProfile(testUserId, {
        displayName: 'Combined Update',
        currentPassword: 'testpassword123',
        newPassword: 'combined789',
      });

      expect(updated.displayName).toBe('Combined Update');

      // Verify both changes in database
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user?.displayName).toBe('Combined Update');
      const isValid = await bcrypt.compare('combined789', user!.passwordHash);
      expect(isValid).toBe(true);

      // Restore for other tests
      const restoredHash = await bcrypt.hash('testpassword123', 10);
      await prisma.user.update({
        where: { id: testUserId },
        data: {
          displayName: 'Test User',
          passwordHash: restoredHash,
        },
      });
    });

    it('should preserve password when not provided', async () => {
      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      const originalHash = user!.passwordHash;

      await userService.updateCurrentUserProfile(testUserId, {
        displayName: 'Name Only Update',
      });

      const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(updatedUser?.passwordHash).toBe(originalHash);
    });
  });
});
