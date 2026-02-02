import { getPrismaClient } from '../../utils/prisma.client';
import { UserRole } from '@prisma/client';
import { PIIRedactionService } from '../../services/pii-redaction.service';
import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';
import * as bcrypt from 'bcrypt';

const prisma = getPrismaClient();

describe('PII_RESTRICTED Role Integration Tests', () => {
    let piiRedactionService: PIIRedactionService;
    let authService: AuthService;
    let userRepository: UserRepository;
    let testParticipantId: string;
    let testVenueId: string;
    let testGeographicAreaId: string;
    let piiRestrictedUserId: string;

    beforeAll(async () => {
        piiRedactionService = new PIIRedactionService();
        userRepository = new UserRepository(prisma);
        authService = new AuthService(userRepository);

        // Create test geographic area
        const geographicArea = await prisma.geographicArea.create({
            data: {
                name: 'Test Area PII',
                areaType: 'CITY',
            },
        });
        testGeographicAreaId = geographicArea.id;

        // Create test venue
        const venue = await prisma.venue.create({
            data: {
                name: 'Test Community Center PII',
                address: '123 Test Street',
                geographicAreaId: testGeographicAreaId,
                latitude: 40.7128,
                longitude: -74.0060,
            },
        });
        testVenueId = venue.id;

        // Create test participant
        const participant = await prisma.participant.create({
            data: {
                name: 'John Doe PII Test',
                email: 'john.pii.test@example.com',
                phone: '+1234567890',
                notes: 'Test notes',
                dateOfBirth: new Date('1990-01-01'),
                nickname: 'Johnny',
            },
        });
        testParticipantId = participant.id;

        // Create PII_RESTRICTED user
        const piiRestrictedPasswordHash = await bcrypt.hash('pii123', 10);
        const piiRestrictedUser = await prisma.user.create({
            data: {
                email: 'pii.integration@test.com',
                passwordHash: piiRestrictedPasswordHash,
                role: UserRole.PII_RESTRICTED,
                displayName: 'PII Restricted User',
            },
        });
        piiRestrictedUserId = piiRestrictedUser.id;
    });

    afterAll(async () => {
        // Clean up test data
        await prisma.participant.deleteMany({ where: { email: { contains: 'pii.test@example.com' } } });
        await prisma.venue.deleteMany({ where: { name: { contains: 'Test Community Center PII' } } });
        await prisma.geographicArea.deleteMany({ where: { name: { contains: 'Test Area PII' } } });
        await prisma.user.deleteMany({ where: { email: { contains: 'pii.integration@test.com' } } });
    });

    describe('JWT Token Generation', () => {
        it('should include PII_RESTRICTED role in JWT token', async () => {
            const tokens = await authService.login({
                email: 'pii.integration@test.com',
                password: 'pii123',
            });

            expect(tokens.accessToken).toBeDefined();
            expect(tokens.user.role).toBe(UserRole.PII_RESTRICTED);

            // Verify token payload contains role
            const payload = authService.validateAccessToken(tokens.accessToken);
            expect(payload.role).toBe(UserRole.PII_RESTRICTED);
        });
    });

    describe('User Role Persistence', () => {
        it('should persist PII_RESTRICTED role in database', async () => {
            const user = await userRepository.findById(piiRestrictedUserId);
            expect(user).toBeDefined();
            expect(user?.role).toBe(UserRole.PII_RESTRICTED);
        });
    });

    describe('Participant Data Redaction', () => {
        it('should redact all PII fields for PII_RESTRICTED role', async () => {
            const participant = await prisma.participant.findUnique({
                where: { id: testParticipantId },
            });

            const redacted = piiRedactionService.redactParticipant(participant, UserRole.PII_RESTRICTED);

            expect(redacted.id).toBe(testParticipantId);
            expect(redacted.name).toBeNull();
            expect(redacted.email).toBeNull();
            expect(redacted.phone).toBeNull();
            expect(redacted.notes).toBeNull();
            expect(redacted.dateOfBirth).toBeNull();
            expect(redacted.nickname).toBeNull();
        });

        it('should not redact participant for other roles', async () => {
            const participant = await prisma.participant.findUnique({
                where: { id: testParticipantId },
            });

            const adminResult = piiRedactionService.redactParticipant(participant, UserRole.ADMINISTRATOR);
            expect(adminResult.name).toBe('John Doe PII Test');

            const editorResult = piiRedactionService.redactParticipant(participant, UserRole.EDITOR);
            expect(editorResult.name).toBe('John Doe PII Test');

            const readOnlyResult = piiRedactionService.redactParticipant(participant, UserRole.READ_ONLY);
            expect(readOnlyResult.name).toBe('John Doe PII Test');
        });
    });

    describe('Venue Data Redaction', () => {
        it('should redact venue name for PII_RESTRICTED role', async () => {
            const venue = await prisma.venue.findUnique({
                where: { id: testVenueId },
            });

            const redacted = piiRedactionService.redactVenue(venue, UserRole.PII_RESTRICTED);

            expect(redacted.id).toBe(testVenueId);
            expect(redacted.name).toBeNull();
            expect(redacted.address).toBe('123 Test Street');
            expect(redacted.geographicAreaId).toBe(testGeographicAreaId);
        });

        it('should preserve non-PII venue fields for PII_RESTRICTED role', async () => {
            const venue = await prisma.venue.findUnique({
                where: { id: testVenueId },
            });

            const redacted = piiRedactionService.redactVenue(venue, UserRole.PII_RESTRICTED);

            expect(redacted.latitude).toBeDefined();
            expect(redacted.longitude).toBeDefined();
            expect(redacted.geographicAreaId).toBe(testGeographicAreaId);
        });
    });

    describe('Non-PII Resource Access', () => {
        it('should not redact geographic areas', async () => {
            const geographicArea = await prisma.geographicArea.findUnique({
                where: { id: testGeographicAreaId },
            });

            const result = piiRedactionService.redactResponse(geographicArea, UserRole.PII_RESTRICTED);

            expect(result.name).toBe('Test Area PII');
            expect(result.areaType).toBe('CITY');
        });

        it('should not redact activity types', async () => {
            const activityTypes = await prisma.activityType.findMany({ take: 1 });
            expect(activityTypes.length).toBeGreaterThan(0);

            const result = piiRedactionService.redactResponse(activityTypes[0], UserRole.PII_RESTRICTED);

            expect(result.name).toBeDefined();
            expect(result.name).not.toBeNull();
        });
    });
});
