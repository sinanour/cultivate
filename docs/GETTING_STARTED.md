# Getting Started - Community Activity Tracker

## Welcome!

This guide will help you get started with developing the Community Activity Tracker system. Follow the steps for your specific role/team.

## Prerequisites

### All Teams
- Git installed and configured
- Access to project repository
- Access to Slack workspace
- Access to project management tools

### Backend Team
- Node.js 20+ installed
- PostgreSQL 15+ installed (or Docker)
- AWS CLI configured
- Prisma CLI installed

### Web Frontend Team
- Node.js 20+ installed
- Modern web browser (Chrome/Firefox/Safari)
- React DevTools extension

### iOS Mobile Team
- macOS with Xcode 15+
- iOS Simulator
- CocoaPods or Swift Package Manager
- Apple Developer account

### Android Mobile Team
- Android Studio latest version
- Android SDK 34+
- Android Emulator
- Google Play Developer account

### Infrastructure Team
- AWS account with appropriate permissions
- AWS CDK CLI installed
- Terraform (optional, if using)
- Docker installed

## Step-by-Step Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd community-activity-tracker
```

### 2. Review Documentation

**Required Reading** (30-60 minutes):
1. `docs/README.md` - Overview of all documentation
2. `docs/API_CONTRACT.md` - Complete API specification
3. `docs/SHARED_DATA_MODELS.md` - Data model definitions
4. `docs/PACKAGE_COORDINATION.md` - Development workflow

**Package-Specific Reading**:
- `.kiro/specs/<your-package>/requirements.md`
- `.kiro/specs/<your-package>/design.md`
- `.kiro/specs/<your-package>/tasks.md`

### 3. Set Up Development Environment

#### Backend Team

```bash
cd backend-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npx prisma migrate dev

# Seed database with test data
npm run seed

# Start development server
npm run dev

# Run tests
npm test
```

**Verify Setup**:
- API running at http://localhost:3000
- Can access http://localhost:3000/api/v1/health
- Database migrations applied successfully
- Tests passing

#### Web Frontend Team

```bash
cd web-frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with API endpoint (http://localhost:3000 for local backend)

# Start development server
npm run dev

# Run tests
npm test
```

**Verify Setup**:
- App running at http://localhost:5173
- Can see login page
- Tests passing

#### iOS Mobile Team

```bash
cd ios-mobile-app

# Install dependencies (if using CocoaPods)
pod install

# Open workspace in Xcode
open CommunityTracker.xcworkspace

# Or if using SPM, open project
open CommunityTracker.xcodeproj
```

**In Xcode**:
1. Select a simulator (iPhone 15 Pro)
2. Build and run (Cmd+R)
3. Run tests (Cmd+U)

**Verify Setup**:
- App builds successfully
- App runs in simulator
- Can see login screen
- Tests passing

#### Android Mobile Team

```bash
cd android-mobile-app

# Open in Android Studio
# File → Open → select android-mobile-app directory
```

**In Android Studio**:
1. Wait for Gradle sync to complete
2. Select an emulator (Pixel 7 Pro)
3. Run app (Shift+F10)
4. Run tests (Ctrl+Shift+F10)

**Verify Setup**:
- App builds successfully
- App runs in emulator
- Can see login screen
- Tests passing

#### Infrastructure Team

```bash
cd infrastructure

# Install dependencies
npm install

# Configure AWS credentials
aws configure

# Set up environment variables
cp .env.example .env
# Edit .env with AWS account details

# Synthesize CloudFormation template
npm run synth

# Deploy to development environment
npm run deploy:dev
```

**Verify Setup**:
- CDK synthesizes successfully
- Can deploy to AWS
- Resources created in AWS console
- Outputs include database endpoint and API URL

### 4. Join Communication Channels

**Slack Channels**:
- Join `#community-tracker-general`
- Join your team-specific channel
- Join `#community-tracker-api-changes`
- Introduce yourself!

**Meetings**:
- Add daily standup to calendar (9:00 AM)
- Add weekly sync to calendar (Fridays 2:00 PM)

### 5. Set Up Development Tools

#### Code Editor
- VS Code (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Prisma (backend)
  - React (web)
- Or your preferred IDE

#### Git Configuration
```bash
# Set up commit message template
git config commit.template .gitmessage

# Set up pre-commit hooks (if using)
npm install -g husky
husky install
```

#### API Testing
- Install Postman or Insomnia
- Import API collection (if available)
- Or use curl/httpie

### 6. Run Your First Task

#### Backend Team
**Task**: Implement authentication endpoints
1. Review `docs/API_CONTRACT.md` → Authentication section
2. Review `docs/SHARED_DATA_MODELS.md` → User model
3. Create Prisma schema for User model
4. Implement POST /auth/login endpoint
5. Implement POST /auth/refresh endpoint
6. Write unit tests
7. Test with Postman
8. Create pull request

#### Web Frontend Team
**Task**: Create login page
1. Review `docs/API_CONTRACT.md` → Authentication section
2. Create login form component
3. Implement form validation
4. Create API client for authentication
5. Store JWT token in localStorage
6. Add error handling
7. Write component tests
8. Create pull request

#### iOS Mobile Team
**Task**: Create login screen
1. Review `docs/API_CONTRACT.md` → Authentication section
2. Create LoginView in SwiftUI
3. Create LoginViewModel
4. Implement form validation
5. Create API client for authentication
6. Store JWT token in Keychain
7. Add error handling
8. Write unit tests
9. Create pull request

#### Android Mobile Team
**Task**: Create login screen
1. Review `docs/API_CONTRACT.md` → Authentication section
2. Create LoginScreen composable
3. Create LoginViewModel
4. Implement form validation
5. Create API client with Retrofit
6. Store JWT token in EncryptedSharedPreferences
7. Add error handling
8. Write unit tests
9. Create pull request

#### Infrastructure Team
**Task**: Deploy development environment
1. Review infrastructure package specification
2. Create CDK stack for database (Aurora PostgreSQL)
3. Create CDK stack for API hosting (ECS Fargate)
4. Create CDK stack for web hosting (S3 + CloudFront)
5. Deploy to AWS
6. Share endpoint URLs with teams
7. Document infrastructure
8. Create pull request

## Development Workflow

### Daily Routine

1. **Morning** (9:00 AM):
   - Attend daily standup
   - Review Slack messages
   - Check for API changes

2. **Development**:
   - Pull latest changes: `git pull origin main`
   - Create feature branch: `git checkout -b feature/your-feature`
   - Write code
   - Write tests
   - Run tests locally
   - Commit changes: `git commit -m "feat: your feature"`

3. **Code Review**:
   - Push branch: `git push origin feature/your-feature`
   - Create pull request
   - Request review from team member
   - Address review comments
   - Merge when approved

4. **End of Day**:
   - Update task status
   - Post progress in Slack
   - Plan tomorrow's work

### Weekly Routine

1. **Monday**:
   - Review sprint goals
   - Plan week's tasks
   - Coordinate with other teams

2. **Wednesday**:
   - Mid-week check-in
   - Adjust plans if needed
   - Resolve blockers

3. **Friday**:
   - Attend weekly sync (2:00 PM)
   - Demo completed features
   - Review next week's priorities
   - Deploy to staging (if ready)

## Common Tasks

### Making API Changes

1. Create RFC document
2. Post in `#community-tracker-api-changes`
3. Wait for feedback (2 business days)
4. Update `docs/API_CONTRACT.md`
5. Implement in backend
6. Update OpenAPI spec
7. Notify frontend teams
8. Frontend teams update clients

### Adding New Data Model

1. Update `docs/SHARED_DATA_MODELS.md`
2. Backend: Update Prisma schema
3. Backend: Create migration
4. Backend: Implement API endpoints
5. Frontend: Generate types
6. Frontend: Implement UI
7. All: Write tests

### Deploying Changes

1. Ensure all tests pass
2. Create pull request
3. Get code review approval
4. Merge to main
5. CI/CD deploys to development
6. Test in development
7. Deploy to staging (Fridays)
8. Test in staging
9. Deploy to production (Tuesdays)

## Troubleshooting

### "API returns 401 Unauthorized"
- Check if JWT token is included in Authorization header
- Check if token is expired
- Check if token format is correct: `Bearer <token>`
- Try logging in again to get fresh token

### "Database connection failed"
- Check if PostgreSQL is running
- Check database credentials in .env
- Check if database exists
- Check if migrations are applied

### "Tests failing"
- Pull latest changes: `git pull origin main`
- Install dependencies: `npm install` (or equivalent)
- Clear cache: `npm run clean` (if available)
- Run tests again
- Check test output for specific errors

### "Build failing"
- Check for TypeScript errors
- Check for linting errors
- Check for missing dependencies
- Clear build cache
- Rebuild from scratch

### "Can't connect to API"
- Check if backend is running
- Check API URL in environment variables
- Check network connectivity
- Check CORS configuration
- Check firewall settings

## Getting Help

### Documentation
1. Check `docs/` directory first
2. Check package-specific docs
3. Check external documentation (AWS, React, etc.)

### Team Members
1. Ask in team-specific Slack channel
2. Ask in daily standup
3. Schedule pairing session
4. Escalate to tech lead if needed

### External Resources
- Stack Overflow
- GitHub Issues
- Official documentation
- Community forums

## Next Steps

After completing setup:

1. **Review your package tasks**:
   - Open `.kiro/specs/<your-package>/tasks.md`
   - Understand the task breakdown
   - Identify dependencies

2. **Start with first task**:
   - Read task description
   - Review related requirements
   - Review related design sections
   - Implement solution
   - Write tests
   - Create pull request

3. **Coordinate with other teams**:
   - Communicate progress
   - Share blockers
   - Ask questions
   - Offer help

4. **Iterate**:
   - Complete tasks incrementally
   - Test frequently
   - Deploy regularly
   - Gather feedback

## Success Checklist

- [ ] Repository cloned
- [ ] Documentation reviewed
- [ ] Development environment set up
- [ ] Tests passing locally
- [ ] Slack channels joined
- [ ] Meetings added to calendar
- [ ] First task identified
- [ ] Team members introduced
- [ ] Development tools configured
- [ ] Ready to start coding!

## Welcome to the Team!

You're now ready to start contributing to the Community Activity Tracker project. Remember:

- **Communicate early and often**
- **Ask questions when stuck**
- **Write tests for your code**
- **Review others' code thoughtfully**
- **Document your decisions**
- **Have fun building something great!**

If you have any questions or need help, don't hesitate to reach out in Slack or during standup. We're all here to support each other.

Happy coding! 🚀
