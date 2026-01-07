// Test setup file
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_ACCESS_TOKEN_EXPIRY = '15m';
process.env.JWT_REFRESH_TOKEN_EXPIRY = '7d';
process.env.NODE_ENV = 'test';

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
