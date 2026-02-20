import { PrismaClient, AuthorizationRuleType, UserRole } from '@prisma/client';
import { ParticipantService } from '../../services/participant.service';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { ParticipantRepository } from '../../repositories/participant.repository';
import { ParticipantAddressHistoryRepository } from '../../repositories/participant-address-history.repository';
import { AssignmentRepository } from '../../repositories/assignment.repository';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

/**
 * Test: Geographic Authorization with Explicit Filter and DENY Rules
 * 
 * This test verifies that when a user has:
 * - ALLOW rule for a parent area (e.g., City)
 * - DENY rule for a child area (e.g., Neighbourhood)
 * 
 * And makes a request with an explicit geographicAreaId filter for the parent area,
 * the results should EXCLUDE entities from the denied child area.
 */
describe('Geographic Area Filtering with DENY Rules', () => {
    let prisma: PrismaClient;
    let participantService: ParticipantService;
    let geoAuthService: GeographicAuthorizationService;
    const testSuffix = Date.now();
    let testUserId: string;
    let cityId: string;
    let allowedNeighbourhoodId: string;
    let deniedNeighbourhoodId: string;
    let allowedVenueId: string;
    let deniedVenueId: string;
    let allowedParticipantId: string;
    let deniedParticipantId: string;

    beforeAll(async () => {
        prisma = getPrismaClient();

        // Initialize repositories
        const participantRepo = new ParticipantRepository(prisma);
        const addressHistoryRepo = new ParticipantAddressHistoryRepository(prisma);
        const assignmentRepo = new AssignmentRepository(prisma);
        const geoAreaRepo = new GeographicAreaRepository(prisma);
        const authRepo = new UserGeographicAuthorizationRepository(prisma);
        const userRepo = new UserRepository(prisma);

        geoAuthService = new GeographicAuthorizationService(authRepo, geoAreaRepo, userRepo);
        participantService = new ParticipantService(
            participantRepo,
            addressHistoryRepo,
            assignmentRepo,
            prisma,
            geoAuthService
        );

        // Create test user
        const user = await prisma.user.create({
            data: {
                email: `test-geo-filter-${testSuffix}@example.com`,
                passwordHash: 'hash',
                role: UserRole.EDITOR,
            },
        });
        testUserId = user.id;

        // Create geographic hierarchy: City -> Allowed Neighbourhood, Denied Neighbourhood
        const city = await prisma.geographicArea.create({
            data: {
                name: `Test City for Filtering ${testSuffix}`,
                areaType: 'CITY',
            },
        });
        cityId = city.id;

        const allowedNeighbourhood = await prisma.geographicArea.create({
            data: {
                name: `Allowed Neighbourhood ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        allowedNeighbourhoodId = allowedNeighbourhood.id;

        const deniedNeighbourhood = await prisma.geographicArea.create({
            data: {
                name: `Denied Neighbourhood ${testSuffix}`,
                areaType: 'NEIGHBOURHOOD',
                parentGeographicAreaId: cityId,
            },
        });
        deniedNeighbourhoodId = deniedNeighbourhood.id;

        // Create venues in each neighbourhood
        const allowedVenue = await prisma.venue.create({
            data: {
                name: `Allowed Venue ${testSuffix}`,
                address: '123 Allowed St',
                geographicAreaId: allowedNeighbourhoodId,
            },
        });
        allowedVenueId = allowedVenue.id;

        const deniedVenue = await prisma.venue.create({
            data: {
                name: `Denied Venue ${testSuffix}`,
                address: '456 Denied St',
                geographicAreaId: deniedNeighbourhoodId,
            },
        });
        deniedVenueId = deniedVenue.id;

        // Create participants with home venues
        const allowedParticipant = await prisma.participant.create({
            data: {
                name: `Allowed Participant ${testSuffix}`,
                email: `allowed-${testSuffix}@example.com`,
            },
        });
        allowedParticipantId = allowedParticipant.id;

        await prisma.participantAddressHistory.create({
            data: {
                participantId: allowedParticipantId,
                venueId: allowedVenueId,
                effectiveFrom: new Date(),
            },
        });

        const deniedParticipant = await prisma.participant.create({
            data: {
                name: `Denied Participant ${testSuffix}`,
                email: `denied-${testSuffix}@example.com`,
            },
        });
        deniedParticipantId = deniedParticipant.id;

        await prisma.participantAddressHistory.create({
            data: {
                participantId: deniedParticipantId,
                venueId: deniedVenueId,
                effectiveFrom: new Date(),
            },
        });

        // Set up authorization rules: ALLOW city, DENY specific neighbourhood
        await geoAuthService.createAuthorizationRule(
            testUserId,
            cityId,
            AuthorizationRuleType.ALLOW,
            testUserId
        );

        await geoAuthService.createAuthorizationRule(
            testUserId,
            deniedNeighbourhoodId,
            AuthorizationRuleType.DENY,
            testUserId
        );
    });

    afterAll(async () => {
        // Clean up in reverse order of creation
        await prisma.participantAddressHistory.deleteMany({
            where: { participantId: { in: [allowedParticipantId, deniedParticipantId] } },
        });
        await prisma.participant.deleteMany({
            where: { id: { in: [allowedParticipantId, deniedParticipantId] } },
        });
        await prisma.venue.deleteMany({
            where: { id: { in: [allowedVenueId, deniedVenueId] } },
        });
        // Delete authorization rules BEFORE deleting geographic areas (foreign key constraint)
        await prisma.userGeographicAuthorization.deleteMany({
            where: { userId: testUserId },
        });
        await prisma.geographicArea.deleteMany({
            where: { id: { in: [allowedNeighbourhoodId, deniedNeighbourhoodId, cityId] } },
        });
        await prisma.user.delete({ where: { id: testUserId } });
        await prisma.$disconnect();
    });

    describe('Explicit Geographic Filter with DENY Rules', () => {
        it('should exclude participants from denied neighbourhood when filtering by city', async () => {
            // Get authorization info
            const authInfo = await geoAuthService.getAuthorizationInfo(testUserId);

            console.log('Authorization Info:', {
                hasRestrictions: authInfo.hasGeographicRestrictions,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                cityId,
                allowedNeighbourhoodId,
                deniedNeighbourhoodId,
            });

            // Verify authorization setup is correct
            expect(authInfo.hasGeographicRestrictions).toBe(true);
            expect(authInfo.authorizedAreaIds).toContain(cityId);
            expect(authInfo.authorizedAreaIds).toContain(allowedNeighbourhoodId);
            expect(authInfo.authorizedAreaIds).not.toContain(deniedNeighbourhoodId);

            // Get participants with explicit city filter
            const participants = await participantService.getAllParticipants(
                cityId, // Explicit filter for city
                authInfo.authorizedAreaIds,
                authInfo.hasGeographicRestrictions
            );

            console.log('Participants returned:', participants.map(p => ({ id: p.id, name: p.name })));

            // Should include participant from allowed neighbourhood
            const allowedFound = participants.find(p => p.id === allowedParticipantId);
            expect(allowedFound).toBeDefined();

            // Should NOT include participant from denied neighbourhood
            const deniedFound = participants.find(p => p.id === deniedParticipantId);
            expect(deniedFound).toBeUndefined();
        });

        it('should exclude participants from denied neighbourhood when filtering by city (paginated)', async () => {
            // Get authorization info
            const authInfo = await geoAuthService.getAuthorizationInfo(testUserId);

            // Get participants with explicit city filter (paginated)
            const result = await participantService.getParticipantsFlexible({
                page: 1,
                limit: 10,
                geographicAreaId: cityId,
                authorizedAreaIds: authInfo.authorizedAreaIds,
                hasGeographicRestrictions: authInfo.hasGeographicRestrictions
            });

            console.log('Paginated participants returned:', result.data.map(p => ({ id: p.id, name: p.name })));

            // Should include participant from allowed neighbourhood
            const allowedFound = result.data.find(p => p.id === allowedParticipantId);
            expect(allowedFound).toBeDefined();

            // Should NOT include participant from denied neighbourhood
            const deniedFound = result.data.find(p => p.id === deniedParticipantId);
            expect(deniedFound).toBeUndefined();
        });

        it('should work correctly with implicit filtering (no explicit geographicAreaId)', async () => {
            // Get authorization info
            const authInfo = await geoAuthService.getAuthorizationInfo(testUserId);

            // Get participants WITHOUT explicit filter (implicit filtering)
            const participants = await participantService.getAllParticipants(
                undefined, // No explicit filter
                authInfo.authorizedAreaIds,
                authInfo.hasGeographicRestrictions
            );

            console.log('Participants with implicit filtering:', participants.map(p => ({ id: p.id, name: p.name })));

            // Should include participant from allowed neighbourhood
            const allowedFound = participants.find(p => p.id === allowedParticipantId);
            expect(allowedFound).toBeDefined();

            // Should NOT include participant from denied neighbourhood
            const deniedFound = participants.find(p => p.id === deniedParticipantId);
            expect(deniedFound).toBeUndefined();
        });
    });
});
