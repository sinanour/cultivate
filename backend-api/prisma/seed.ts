import { PrismaClient } from '@prisma/client';
import { AuthService } from '../src/services/auth.service';
import { UserRepository } from '../src/repositories/user.repository';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting database seed...');

    // Seed root administrator user
    const rootAdminEmail = process.env.SRP_ROOT_ADMIN_EMAIL;
    const rootAdminPassword = process.env.SRP_ROOT_ADMIN_PASSWORD;

    if (!rootAdminEmail || !rootAdminPassword) {
        console.warn('Warning: SRP_ROOT_ADMIN_EMAIL or SRP_ROOT_ADMIN_PASSWORD not set. Skipping root administrator creation.');
    } else {
        // Use AuthService to hash the password
        const userRepository = new UserRepository(prisma);
        const authService = new AuthService(userRepository);
        const passwordHash = await authService.hashPassword(rootAdminPassword);

        await prisma.user.upsert({
            where: { email: rootAdminEmail },
            update: {
                passwordHash,
                role: 'ADMINISTRATOR',
            },
            create: {
                email: rootAdminEmail,
                passwordHash,
                role: 'ADMINISTRATOR',
            },
        });

        console.log(`Seeded root administrator user: ${rootAdminEmail}`);
    }

    // Seed predefined activity types
    const activityTypes = [
        { name: "Children's Class" },
        { name: 'Junior Youth Group' },
        { name: 'Devotional Gathering' },
        { name: 'Ruhi Book 1' },
        { name: 'Ruhi Book 2' },
        { name: 'Ruhi Book 3' },
        { name: 'Ruhi Book 3A' },
        { name: 'Ruhi Book 3B' },
        { name: 'Ruhi Book 3C' },
        { name: 'Ruhi Book 3D' },
        { name: 'Ruhi Book 4' },
        { name: 'Ruhi Book 5' },
        { name: 'Ruhi Book 5A' },
        { name: 'Ruhi Book 5B' },
        { name: 'Ruhi Book 6' },
        { name: 'Ruhi Book 7' },
        { name: 'Ruhi Book 8' },
        { name: 'Ruhi Book 9' },
        { name: 'Ruhi Book 10' },
        { name: 'Ruhi Book 11' },
        { name: 'Ruhi Book 12' },
        { name: 'Ruhi Book 13' },
        { name: 'Ruhi Book 14' },
    ];

    for (const activityType of activityTypes) {
        await prisma.activityType.upsert({
            where: { name: activityType.name },
            update: {},
            create: activityType,
        });
    }

    console.log(`Seeded ${activityTypes.length} activity types`);

    // Seed predefined roles
    const roles = [
        { name: 'Facilitator' },
        { name: 'Animator' },
        { name: 'Host' },
        { name: 'Teacher' },
    ];

    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: role,
        });
    }

    console.log(`Seeded ${roles.length} roles`);

    console.log('Database seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('Error during database seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
