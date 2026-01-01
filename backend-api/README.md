# Cultivate - Backend API

RESTful API service for the Cultivate system.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod
- **Password Hashing**: bcrypt

## Project Structure

```
backend-api/
├── src/
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic layer
│   ├── repositories/   # Data access layer
│   ├── middleware/     # Express middleware
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript type definitions
│   └── index.ts        # Application entry point
├── prisma/             # Prisma schema and migrations
├── dist/               # Compiled JavaScript output
└── tests/              # Test files
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher (or use the automated local setup script)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your database:

   **Option A: Automated Local Setup (Recommended for Development)**
   
   Use our automated script to set up a local PostgreSQL database using Finch:
   ```bash
   npm run db:setup
   ```
   
   This script will:
   - Install Finch container runtime if not already installed (open-source, no licensing restrictions)
   - Pull and start a PostgreSQL container
   - Create a persistent volume for your data
   - Output the connection string for your `.env` file
   
   See `scripts/README.md` for detailed documentation about the setup script.
   
   **Option B: Use Your Own PostgreSQL Instance**
   
   If you already have PostgreSQL installed or prefer to use your own instance:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. Initialize Prisma:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

### Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Building

Build the project:
```bash
npm run build
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Linting and Formatting

Lint code:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

Format code:
```bash
npm run format
```

## API Documentation

Once the server is running, API documentation is available at:
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI Spec: `http://localhost:3000/api/docs/openapi.json`

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run db:setup` - Set up local PostgreSQL database using Finch (development only)

## Local Database Setup

For local development, we provide an automated script that sets up PostgreSQL using Finch container runtime:

```bash
npm run db:setup
```

**Why Finch?**
- Open-source (Apache 2.0 license) with no licensing restrictions
- Docker-compatible CLI
- Lightweight and efficient
- Works on macOS, Linux, and Windows (WSL2)
- Maintained by AWS and the open-source community

For detailed documentation about the database setup script, see `scripts/README.md`.

## License

MIT
