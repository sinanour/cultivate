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

    // Seed predefined activity categories
    const activityCategories = [
        { name: 'Study Circles' },
        { name: "Children's Classes" },
        { name: 'Junior Youth Groups' },
        { name: 'Devotional Gatherings' },
    ];

    const categoryMap: Record<string, string> = {};

    for (const category of activityCategories) {
        const createdCategory = await prisma.activityCategory.upsert({
            where: { name: category.name },
            update: { isPredefined: true },
            create: { ...category, isPredefined: true },
        });
        categoryMap[category.name] = createdCategory.id;
    }

    console.log(`Seeded ${activityCategories.length} activity categories`);

    // Seed predefined activity types with category mappings
    const activityTypesWithCategories = [
        { name: "Children's Class", categoryName: "Children's Classes" },
        { name: 'Junior Youth Group', categoryName: 'Junior Youth Groups' },
        { name: 'Devotional Gathering', categoryName: 'Devotional Gatherings' },
        { name: 'Ruhi Book 1', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 2', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 3', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 3A', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 3B', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 3C', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 3D', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 4', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 5', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 5A', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 5B', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 6', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 7', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 8', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 9', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 10', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 11', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 12', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 13', categoryName: 'Study Circles' },
        { name: 'Ruhi Book 14', categoryName: 'Study Circles' },
    ];

    for (const activityType of activityTypesWithCategories) {
        await prisma.activityType.upsert({
            where: { name: activityType.name },
            update: { isPredefined: true },
            create: {
                name: activityType.name,
                activityCategoryId: categoryMap[activityType.categoryName],
                isPredefined: true,
            },
        });
    }

    console.log(`Seeded ${activityTypesWithCategories.length} activity types`);


    // Seed predefined roles
    const roles = [
        { name: 'Tutor' },
        { name: 'Teacher' },
        { name: 'Animator' },
        { name: 'Host' },
        { name: 'Participant' },
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
