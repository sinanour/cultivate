import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting database seed...');

    // Seed predefined activity types
    const activityTypes = [
        { name: 'Workshop' },
        { name: 'Meeting' },
        { name: 'Social Event' },
        { name: 'Training' },
        { name: 'Conference' },
        { name: 'Volunteer Activity' },
        { name: 'Community Service' },
        { name: 'Educational Program' },
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
        { name: 'Participant' },
        { name: 'Organizer' },
        { name: 'Volunteer' },
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
