// Test setup file
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_ACCESS_TOKEN_EXPIRY = '15m';
process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d';
process.env.NODE_ENV = 'test';

// Override DATABASE_URL for tests if not already set to a test database
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('test')) {
    // Use test database
    process.env.DATABASE_URL = 'postgresql://cat_user:cat_local_dev_password@localhost:5432/community_activity_tracker_test?schema=public';
    console.log('📝 Using test database: community_activity_tracker_test');
}

// Safety check: Ensure tests are running against a test database
// This prevents accidentally running tests against production or development databases
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('test')) {
    console.error('❌ DANGER: Tests must run against a test database!');
    console.error('   DATABASE_URL must contain "test" in the connection string');
    console.error(`   Current DATABASE_URL: ${process.env.DATABASE_URL}`);
    console.error('   Example: postgresql://user:pass@localhost:5432/cultivate_test');
    throw new Error('Tests must run against a test database! DATABASE_URL must contain "test"');
}

console.log('✅ Test database check passed');

/**
 * Global test setup - runs once before all tests
 * Ensures database schema is up-to-date by running migrations
 */
async function globalSetup() {
    console.log('🔧 Running database migrations...');

    try {
        // Run migrations
        execSync('npx prisma migrate deploy', {
            stdio: 'pipe',
            env: process.env,
        });

        console.log('✅ Migrations completed successfully');

        // Verify schema
        const prisma = new PrismaClient();
        await prisma.$connect();

        // Check for additionalParticipantCount column
        const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'activities' 
            AND column_name = 'additionalParticipantCount'
        `;

        if (!result || result.length === 0) {
            throw new Error(
                'Migration verification failed: additionalParticipantCount column not found in activities table'
            );
        }

        console.log('✅ Schema verification passed');

        await prisma.$disconnect();
    } catch (error: any) {
        console.error('❌ Migration or schema verification failed:', error.message);
        throw error;
    }
}

// Run migrations before all tests
beforeAll(async () => {
    await globalSetup();
}, 30000); // 30 second timeout for migrations
