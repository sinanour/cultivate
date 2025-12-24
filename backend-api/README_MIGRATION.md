# Database Migration Instructions

## Prerequisites

Before running migrations, ensure you have:
1. PostgreSQL 14+ installed and running
2. Created a database for the application
3. Updated the `.env` file with your database connection string

## Running Migrations

### First Time Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Update the `DATABASE_URL` in `.env` with your PostgreSQL connection:
```
DATABASE_URL="postgresql://username:password@localhost:5432/community_activity_tracker?schema=public"
```

3. Generate the Prisma client:
```bash
npm run prisma:generate
```

4. Run the initial migration:
```bash
npm run prisma:migrate
```

When prompted, provide a migration name like "init" or "initial_schema".

5. The seed data will run automatically after the migration, creating:
   - 8 predefined activity types (Workshop, Meeting, Social Event, etc.)
   - 7 predefined roles (Facilitator, Animator, Host, Teacher, etc.)

### Subsequent Migrations

After making changes to the Prisma schema:

1. Generate a new migration:
```bash
npm run prisma:migrate
```

2. Provide a descriptive migration name when prompted

### Manual Seeding

If you need to run the seed script manually:
```bash
npx prisma db seed
```

## Prisma Studio

To view and edit your database data using Prisma Studio:
```bash
npm run prisma:studio
```

This will open a web interface at `http://localhost:5555`

## Troubleshooting

### Connection Issues

If you get connection errors:
- Verify PostgreSQL is running
- Check your DATABASE_URL is correct
- Ensure the database exists
- Verify your user has proper permissions

### Migration Conflicts

If migrations fail:
- Check for schema conflicts
- Review the error message
- You may need to reset the database (WARNING: destroys all data):
```bash
npx prisma migrate reset
```

### Seed Failures

If seeding fails:
- Check the error message in the console
- Verify the database schema is up to date
- Ensure no conflicting data exists
