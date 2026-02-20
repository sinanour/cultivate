import { PrismaClient, AreaType, ActivityStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as readline from 'readline';

// Configuration interface
interface GenerationConfig {
    geographicAreas: number;
    venues: number;
    participants: number;
    activities: number;
}

// Geographic area type distribution
const AREA_TYPE_DISTRIBUTION = {
    COUNTRY: 0.02,
    STATE: 0.05,
    PROVINCE: 0.03,
    CLUSTER: 0.20,
    CITY: 0.30,
    NEIGHBOURHOOD: 0.40,
};

// Hierarchy rules - which types can be parents of which types
const HIERARCHY_RULES: Record<AreaType, AreaType[]> = {
    COUNTRY: [],
    STATE: ['COUNTRY'],
    PROVINCE: ['COUNTRY'],
    CLUSTER: ['COUNTRY', 'STATE', 'PROVINCE'],
    COUNTY: ['STATE', 'PROVINCE'],
    CITY: ['CLUSTER', 'COUNTY', 'PROVINCE', 'STATE', 'COUNTRY'],
    COMMUNITY: ['CITY', 'CLUSTER'],
    NEIGHBOURHOOD: ['CITY', 'COMMUNITY'],
    CONTINENT: [],
    HEMISPHERE: [],
    WORLD: [],
};

// Global coordinates for distributing countries
const GLOBAL_COORDINATES = [
    { lat: 40.7128, lon: -74.0060 },  // New York
    { lat: 51.5074, lon: -0.1278 },   // London
    { lat: 35.6762, lon: 139.6503 },  // Tokyo
    { lat: -33.8688, lon: 151.2093 }, // Sydney
    { lat: 19.4326, lon: -99.1332 },  // Mexico City
    { lat: -23.5505, lon: -46.6333 }, // São Paulo
    { lat: 55.7558, lon: 37.6173 },   // Moscow
    { lat: 28.6139, lon: 77.2090 },   // New Delhi
    { lat: 31.2304, lon: 121.4737 },  // Shanghai
    { lat: 1.3521, lon: 103.8198 },   // Singapore
    { lat: -1.2921, lon: 36.8219 },   // Nairobi
    { lat: 30.0444, lon: 31.2357 },   // Cairo
    { lat: -26.2041, lon: 28.0473 },  // Johannesburg
    { lat: 25.2048, lon: 55.2708 },   // Dubai
    { lat: 41.9028, lon: 12.4964 },   // Rome
    { lat: 48.8566, lon: 2.3522 },    // Paris
    { lat: 52.5200, lon: 13.4050 },   // Berlin
    { lat: 59.3293, lon: 18.0686 },   // Stockholm
    { lat: -34.6037, lon: -58.3816 }, // Buenos Aires
    { lat: 6.5244, lon: 3.3792 },     // Lagos
];

const BATCH_SIZE = 1000;

// Generate deterministic UUID from name using MD5
function generateDeterministicUUID(name: string): string {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    // Format as UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}

// Pseudo-random assignment using UUID modulo
function assignToEntity(seed: string, totalEntities: number): number {
    const uuid = generateDeterministicUUID(seed);
    const numericValue = parseInt(uuid.replace(/-/g, '').slice(0, 8), 16);
    return numericValue % totalEntities;
}

// Prompt user for confirmation
async function promptConfirmation(config: GenerationConfig): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log('\n=== Fake Data Generation Configuration ===');
    console.log(`Geographic Areas: ${config.geographicAreas.toLocaleString()}`);
    console.log(`Venues: ${config.venues.toLocaleString()}`);
    console.log(`Participants: ${config.participants.toLocaleString()}`);
    console.log(`Activities: ${config.activities.toLocaleString()}`);
    console.log('==========================================\n');

    return new Promise((resolve) => {
        rl.question('Do you want to proceed? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

// Determine area type based on index and distribution
function determineAreaType(index: number, total: number): AreaType {
    const countryCount = Math.floor(total * AREA_TYPE_DISTRIBUTION.COUNTRY);
    const stateCount = Math.floor(total * AREA_TYPE_DISTRIBUTION.STATE);
    const provinceCount = Math.floor(total * AREA_TYPE_DISTRIBUTION.PROVINCE);
    const clusterCount = Math.floor(total * AREA_TYPE_DISTRIBUTION.CLUSTER);
    const cityCount = Math.floor(total * AREA_TYPE_DISTRIBUTION.CITY);

    if (index < countryCount) return 'COUNTRY';
    if (index < countryCount + stateCount) return 'STATE';
    if (index < countryCount + stateCount + provinceCount) return 'PROVINCE';
    if (index < countryCount + stateCount + provinceCount + clusterCount) return 'CLUSTER';
    if (index < countryCount + stateCount + provinceCount + clusterCount + cityCount) return 'CITY';
    return 'NEIGHBOURHOOD';
}

// Generate geographic areas with proper hierarchy
async function generateGeographicAreas(prisma: PrismaClient, config: GenerationConfig) {
    console.log('\nGenerating geographic areas...');

    const areas: Array<{ id: string; name: string; areaType: AreaType; parentGeographicAreaId: string | null }> = [];
    const countrySubdivisionTypes: Record<string, AreaType> = {};
    const areasByType: Record<AreaType, Array<{ id: string; name: string }>> = {
        COUNTRY: [], STATE: [], PROVINCE: [], CLUSTER: [], COUNTY: [], CITY: [], COMMUNITY: [], NEIGHBOURHOOD: [], CONTINENT: [], HEMISPHERE: [], WORLD: []
    };

    // Generate all areas
    for (let i = 0; i < config.geographicAreas; i++) {
        const areaType = determineAreaType(i, config.geographicAreas);
        const name = `${areaType} ${String(i).padStart(6, '0')}`;
        const id = generateDeterministicUUID(name);

        let parentId: string | null = null;

        if (areaType !== 'COUNTRY') {
            const validParentTypes = HIERARCHY_RULES[areaType];

            // For immediate country subdivisions, use consistent type
            if (validParentTypes.includes('COUNTRY') && areasByType.COUNTRY.length > 0) {
                const countryIndex = assignToEntity(id, areasByType.COUNTRY.length);
                const country = areasByType.COUNTRY[countryIndex];

                // Determine or get subdivision type for this country
                if (!countrySubdivisionTypes[country.id]) {
                    // Randomly select subdivision type for this country (only STATE, PROVINCE, or CLUSTER)
                    const subdivisionOptions: AreaType[] = ['STATE', 'PROVINCE', 'CLUSTER'];
                    const validSubdivisions = subdivisionOptions.filter(t => validParentTypes.includes(t));
                    if (validSubdivisions.length > 0 && validSubdivisions.includes(areaType)) {
                        countrySubdivisionTypes[country.id] = areaType;
                    }
                }

                // If this area type matches the country's subdivision type, use country as parent
                if (countrySubdivisionTypes[country.id] === areaType) {
                    parentId = country.id;
                }
            }

            // If no parent assigned yet, find from valid parent types
            if (!parentId) {
                for (const parentType of validParentTypes) {
                    if (areasByType[parentType].length > 0) {
                        const parentIndex = assignToEntity(id, areasByType[parentType].length);
                        parentId = areasByType[parentType][parentIndex].id;
                        break;
                    }
                }
            }
        }

        areas.push({ id, name, areaType, parentGeographicAreaId: parentId });
        areasByType[areaType].push({ id, name });

        // Batch upsert
        if (areas.length >= BATCH_SIZE) {
            await prisma.geographicArea.createMany({
                data: areas,
                skipDuplicates: true,
            });
            console.log(`  Created ${areas.length} geographic areas (${Math.round((i / config.geographicAreas) * 100)}%)`);
            areas.length = 0;
        }
    }

    // Final batch
    if (areas.length > 0) {
        await prisma.geographicArea.createMany({
            data: areas,
            skipDuplicates: true,
        });
    }

    console.log(`✓ Generated ${config.geographicAreas.toLocaleString()} geographic areas`);
}

// Find leaf-node geographic areas
async function findLeafNodes(prisma: PrismaClient): Promise<string[]> {
    const allAreas = await prisma.geographicArea.findMany({
        select: { id: true },
    });

    const areasWithChildren = await prisma.geographicArea.findMany({
        where: {
            children: {
                some: {},
            },
        },
        select: { id: true },
    });

    const areasWithChildrenSet = new Set(areasWithChildren.map(a => a.id));
    return allAreas.filter(a => !areasWithChildrenSet.has(a.id)).map(a => a.id);
}

// Generate venue coordinates within 10km radius
function generateVenueCoordinates(baseCoords: { lat: number; lon: number }, venueIndex: number) {
    const angle = (venueIndex * 137.5) % 360; // Golden angle for even distribution
    const distance = Math.sqrt(venueIndex % 100) * 0.09; // Up to ~10km (0.09 degrees ≈ 10km)
    const lat = baseCoords.lat + (distance * Math.cos((angle * Math.PI) / 180));
    const lon = baseCoords.lon + (distance * Math.sin((angle * Math.PI) / 180));
    return { lat, lon };
}

// Generate venues
async function generateVenues(prisma: PrismaClient, config: GenerationConfig, leafNodeIds: string[]) {
    console.log('\nGenerating venues...');

    if (leafNodeIds.length === 0) {
        console.warn('Warning: No leaf-node geographic areas found. Skipping venue generation.');
        return [];
    }

    const venues: Array<{ id: string; name: string; address: string; geographicAreaId: string; latitude: number; longitude: number }> = [];
    const venueIds: string[] = [];

    for (let i = 0; i < config.venues; i++) {
        const assignmentKey = generateDeterministicUUID(`venue-assignment-${i}`);
        const leafNodeIndex = assignToEntity(assignmentKey, leafNodeIds.length);
        const geographicAreaId = leafNodeIds[leafNodeIndex];

        if (!geographicAreaId) {
            console.error(`ERROR: No geographic area ID at index ${leafNodeIndex} (total leaf nodes: ${leafNodeIds.length})`);
            throw new Error('Invalid leaf node index');
        }

        // Get geographic area name for venue naming
        const serial = String(i % 1000).padStart(3, '0');
        const name = `Area ${geographicAreaId.slice(0, 8)} Venue ${serial}`;
        const id = generateDeterministicUUID(name);

        // Generate coordinates
        const coordIndex = assignToEntity(geographicAreaId, GLOBAL_COORDINATES.length);
        const baseCoords = GLOBAL_COORDINATES[coordIndex];
        const venueCoords = generateVenueCoordinates(baseCoords, i);

        venues.push({
            id,
            name,
            address: `${i} Main Street`,
            geographicAreaId,
            latitude: venueCoords.lat,
            longitude: venueCoords.lon,
        });
        venueIds.push(id);

        // Batch upsert
        if (venues.length >= BATCH_SIZE) {
            await prisma.venue.createMany({
                data: venues,
                skipDuplicates: true,
            });
            console.log(`  Created ${i + 1} venues (${Math.round(((i + 1) / config.venues) * 100)}%)`);
            venues.length = 0;
        }
    }

    // Final batch
    if (venues.length > 0) {
        await prisma.venue.createMany({
            data: venues,
            skipDuplicates: true,
        });
    }

    console.log(`✓ Generated ${config.venues.toLocaleString()} venues`);
    return venueIds;
}

// Generate participants
async function generateParticipants(prisma: PrismaClient, config: GenerationConfig, venueIds: string[]) {
    console.log('\nGenerating participants...');

    if (venueIds.length === 0) {
        console.warn('Warning: No venues found. Skipping participant generation.');
        return [];
    }

    const participants: Array<{ id: string; name: string; dateOfBirth: Date }> = [];
    const addressHistory: Array<{ id: string; participantId: string; venueId: string; effectiveFrom: null }> = [];
    const participantIds: string[] = [];

    for (let i = 0; i < config.participants; i++) {
        const name = `Participant ${String(i).padStart(8, '0')}`;
        const id = generateDeterministicUUID(name);
        const ageInMillis = assignToEntity(name, 30000) * 86400000;
        const nowInMillis = new Date().getTime();
        const todayInMillis = nowInMillis - (nowInMillis % 86400000)
        const dateOfBirth = new Date(todayInMillis - ageInMillis);

        participants.push({ id, name, dateOfBirth });
        participantIds.push(id);

        // Assign to venue
        const venueIndex = assignToEntity(id, venueIds.length);
        const venueId = venueIds[venueIndex];

        addressHistory.push({
            id: generateDeterministicUUID(`${id}-${venueId}-address`),
            participantId: id,
            venueId,
            effectiveFrom: null, // Oldest address
        });

        // Batch upsert
        if (participants.length >= BATCH_SIZE) {
            await prisma.participant.createMany({
                data: participants,
                skipDuplicates: true,
            });
            await prisma.participantAddressHistory.createMany({
                data: addressHistory,
                skipDuplicates: true,
            });
            console.log(`  Created ${i + 1} participants (${Math.round(((i + 1) / config.participants) * 100)}%)`);
            participants.length = 0;
            addressHistory.length = 0;
        }
    }

    // Final batch
    if (participants.length > 0) {
        await prisma.participant.createMany({
            data: participants,
            skipDuplicates: true,
        });
        await prisma.participantAddressHistory.createMany({
            data: addressHistory,
            skipDuplicates: true,
        });
    }

    console.log(`✓ Generated ${config.participants.toLocaleString()} participants`);
    return participantIds;
}

// Get predefined activity types and roles
async function getPredefinedData(prisma: PrismaClient) {
    const activityTypes = await prisma.activityType.findMany({
        where: { isPredefined: true },
        select: { id: true },
    });

    const roles = await prisma.role.findMany({
        select: { id: true },
    });

    return { activityTypeIds: activityTypes.map(t => t.id), roleIds: roles.map(r => r.id) };
}

// Determine number of participants for an activity (3-15)
function getParticipantCount(activityUUID: string): number {
    return 3 + assignToEntity(activityUUID, 13); // 3 to 15 inclusive
}

// Generate activities and assignments
async function generateActivities(
    prisma: PrismaClient,
    config: GenerationConfig,
    venueIds: string[],
    participantIds: string[],
    activityTypeIds: string[],
    roleIds: string[]
) {
    console.log('\nGenerating activities...');

    if (venueIds.length === 0 || activityTypeIds.length === 0) {
        console.warn('Warning: No venues or activity types found. Skipping activity generation.');
        return;
    }

    const activities: Array<{
        id: string;
        name: string;
        activityTypeId: string;
        startDate: Date;
        endDate: Date | null;
        status: ActivityStatus;
    }> = [];
    const venueHistory: Array<{ id: string; activityId: string; venueId: string; effectiveFrom: null }> = [];
    const assignments: Array<{ id: string; activityId: string; participantId: string; roleId: string }> = [];

    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    for (let i = 0; i < config.activities; i++) {
        const name = `Activity ${String(i).padStart(8, '0')}`;
        const id = generateDeterministicUUID(name);

        // Assign activity type
        const typeIndex = assignToEntity(id, activityTypeIds.length);
        const activityTypeId = activityTypeIds[typeIndex];

        // Assign venue
        const venueIndex = assignToEntity(id, venueIds.length);
        const venueId = venueIds[venueIndex];

        // Generate dates
        const dayOffset = assignToEntity(id + 'start', 365);
        const startDate = new Date(oneYearAgo.getTime() + dayOffset * 24 * 60 * 60 * 1000);

        // 10% ongoing (null endDate), 90% finite
        const isOngoing = (assignToEntity(id + 'ongoing', 10) === 0);
        const endDate = isOngoing ? null : new Date(startDate.getTime() + (30 + assignToEntity(id + 'duration', 90)) * 24 * 60 * 60 * 1000);

        // Status distribution: 70% PLANNED, 20% ACTIVE, 10% COMPLETED
        const statusRand = assignToEntity(id + 'status', 10);
        const status: ActivityStatus = statusRand < 7 ? 'PLANNED' : statusRand < 9 ? 'ACTIVE' : 'COMPLETED';

        activities.push({ id, name, activityTypeId, startDate, endDate, status });

        venueHistory.push({
            id: generateDeterministicUUID(`${id}-${venueId}-venue`),
            activityId: id,
            venueId,
            effectiveFrom: null, // Uses activity startDate
        });

        // Assign participants (3-15)
        const participantCount = getParticipantCount(id);
        const assignedParticipants = new Set<string>();

        for (let j = 0; j < participantCount; j++) {
            // Use a combination of activity ID and participant index for better distribution
            const participantSeed = generateDeterministicUUID(`${id}-participant-${j}`);
            const participantIndex = assignToEntity(participantSeed, participantIds.length);
            const participantId = participantIds[participantIndex];

            // Skip if we've already assigned this participant to this activity
            if (assignedParticipants.has(participantId)) {
                continue;
            }

            assignedParticipants.add(participantId);

            const roleIndex = assignToEntity(id + participantId, roleIds.length);
            const roleId = roleIds[roleIndex];

            assignments.push({
                id: generateDeterministicUUID(`${id}-${participantId}-${roleId}`),
                activityId: id,
                participantId,
                roleId,
            });
        }

        // Batch upsert
        if (activities.length >= BATCH_SIZE) {
            await prisma.activity.createMany({
                data: activities,
                skipDuplicates: true,
            });
            await prisma.activityVenueHistory.createMany({
                data: venueHistory,
                skipDuplicates: true,
            });
            await prisma.assignment.createMany({
                data: assignments,
                skipDuplicates: true,
            });
            console.log(`  Created ${i + 1} activities (${Math.round(((i + 1) / config.activities) * 100)}%)`);
            activities.length = 0;
            venueHistory.length = 0;
            assignments.length = 0;
        }
    }

    // Final batch
    if (activities.length > 0) {
        await prisma.activity.createMany({
            data: activities,
            skipDuplicates: true,
        });
        await prisma.activityVenueHistory.createMany({
            data: venueHistory,
            skipDuplicates: true,
        });
        await prisma.assignment.createMany({
            data: assignments,
            skipDuplicates: true,
        });
    }

    console.log(`✓ Generated ${config.activities.toLocaleString()} activities`);
    console.log(`✓ Generated ${assignments.length.toLocaleString()} assignments`);
}

// Prompt user for removal confirmation
async function promptRemovalConfirmation(): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    console.log('\n⚠️  WARNING: This will delete all auto-generated fake data!');
    console.log('Manual records and predefined seed data will be preserved.\n');

    return new Promise((resolve) => {
        rl.question('Do you want to proceed with deletion? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

// Remove all fake data
async function removeFakeData(prisma: PrismaClient) {
    console.log('\nRemoving fake data...');

    // 1. Delete assignments (references activities, participants, roles)
    console.log('Deleting assignments...');
    const assignmentResult = await prisma.assignment.deleteMany({
        where: {
            AND: [
                { activity: { name: { startsWith: 'Activity ' } } },
                { participant: { name: { startsWith: 'Participant ' } } },
            ],
        },
    });
    console.log(`  ✓ Deleted ${assignmentResult.count.toLocaleString()} assignments`);

    // 2. Delete activity venue history (references activities, venues)
    console.log('Deleting activity venue history...');
    const activityVenueResult = await prisma.activityVenueHistory.deleteMany({
        where: {
            activity: { name: { startsWith: 'Activity ' } },
        },
    });
    console.log(`  ✓ Deleted ${activityVenueResult.count.toLocaleString()} activity venue history records`);

    // 3. Delete activities
    console.log('Deleting activities...');
    const activityResult = await prisma.activity.deleteMany({
        where: { name: { startsWith: 'Activity ' } },
    });
    console.log(`  ✓ Deleted ${activityResult.count.toLocaleString()} activities`);

    // 4. Delete participant address history (references participants, venues)
    console.log('Deleting participant address history...');
    const addressHistoryResult = await prisma.participantAddressHistory.deleteMany({
        where: {
            participant: { name: { startsWith: 'Participant ' } },
        },
    });
    console.log(`  ✓ Deleted ${addressHistoryResult.count.toLocaleString()} address history records`);

    // 5. Delete participant population associations (references participants, populations)
    console.log('Deleting participant population associations...');
    const participantPopulationResult = await prisma.participantPopulation.deleteMany({
        where: {
            participant: { name: { startsWith: 'Participant ' } },
        },
    });
    console.log(`  ✓ Deleted ${participantPopulationResult.count.toLocaleString()} participant population associations`);

    // 6. Delete participants
    console.log('Deleting participants...');
    const participantResult = await prisma.participant.deleteMany({
        where: { name: { startsWith: 'Participant ' } },
    });
    console.log(`  ✓ Deleted ${participantResult.count.toLocaleString()} participants`);

    // 7. Delete venues (match pattern "Area {8 hex chars} Venue {3 digits}")
    console.log('Deleting venues...');
    const venueResult = await prisma.venue.deleteMany({
        where: { name: { startsWith: 'Area ' } },
    });
    console.log(`  ✓ Deleted ${venueResult.count.toLocaleString()} venues`);

    // 8. Delete geographic areas (match pattern "{TYPE} {6 digits}")
    console.log('Deleting geographic areas...');
    const areaResult = await prisma.geographicArea.deleteMany({
        where: {
            OR: [
                { name: { startsWith: 'COUNTRY ' } },
                { name: { startsWith: 'STATE ' } },
                { name: { startsWith: 'PROVINCE ' } },
                { name: { startsWith: 'CLUSTER ' } },
                { name: { startsWith: 'COUNTY ' } },
                { name: { startsWith: 'CITY ' } },
                { name: { startsWith: 'COMMUNITY ' } },
                { name: { startsWith: 'NEIGHBOURHOOD ' } },
                { name: { startsWith: 'CONTINENT ' } },
                { name: { startsWith: 'HEMISPHERE ' } },
                { name: { startsWith: 'WORLD ' } },
            ],
        },
    });
    console.log(`  ✓ Deleted ${areaResult.count.toLocaleString()} geographic areas`);

    return {
        assignments: assignmentResult.count,
        activityVenueHistory: activityVenueResult.count,
        activities: activityResult.count,
        addressHistory: addressHistoryResult.count,
        participantPopulations: participantPopulationResult.count,
        participants: participantResult.count,
        venues: venueResult.count,
        geographicAreas: areaResult.count,
    };
}

// Main function
async function main() {
    // Safety check: NODE_ENV must be "development"
    if (process.env.NODE_ENV !== 'development') {
        console.error('ERROR: This script can only run when NODE_ENV is set to "development"');
        console.error(`Current NODE_ENV: ${process.env.NODE_ENV || '(not set)'}`);
        process.exit(1);
    }

    // Parse command-line arguments
    const args = process.argv.slice(2);
    let removeMode = false;
    const config: GenerationConfig = {
        geographicAreas: 10000,
        venues: 1000000,
        participants: 10000000,
        activities: 20000000,
    };

    for (const arg of args) {
        if (arg === '--remove') {
            removeMode = true;
        } else if (arg.startsWith('--areas=')) {
            config.geographicAreas = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--venues=')) {
            config.venues = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--participants=')) {
            config.participants = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--activities=')) {
            config.activities = parseInt(arg.split('=')[1], 10);
        }
    }

    const prisma = new PrismaClient();
    const startTime = Date.now();

    try {
        // Test database connection
        await prisma.$connect();
        console.log('✓ Database connection established');

        if (removeMode) {
            // Removal mode
            const confirmed = await promptRemovalConfirmation();
            if (!confirmed) {
                console.log('Removal cancelled by user.');
                process.exit(0);
            }

            const deletionCounts = await removeFakeData(prisma);

            // Summary
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log('\n=== Removal Complete ===');
            console.log(`Assignments: ${deletionCounts.assignments.toLocaleString()}`);
            console.log(`Activity Venue History: ${deletionCounts.activityVenueHistory.toLocaleString()}`);
            console.log(`Activities: ${deletionCounts.activities.toLocaleString()}`);
            console.log(`Address History: ${deletionCounts.addressHistory.toLocaleString()}`);
            console.log(`Participant Populations: ${deletionCounts.participantPopulations.toLocaleString()}`);
            console.log(`Participants: ${deletionCounts.participants.toLocaleString()}`);
            console.log(`Venues: ${deletionCounts.venues.toLocaleString()}`);
            console.log(`Geographic Areas: ${deletionCounts.geographicAreas.toLocaleString()}`);
            console.log(`Execution time: ${elapsed}s`);
            console.log('========================\n');
        } else {
            // Generation mode
            const confirmed = await promptConfirmation(config);
            if (!confirmed) {
                console.log('Generation cancelled by user.');
                process.exit(0);
            }

            // Generate data
            await generateGeographicAreas(prisma, config);

            const leafNodeIds = await findLeafNodes(prisma);
            console.log(`Found ${leafNodeIds.length.toLocaleString()} leaf-node geographic areas`);

            const venueIds = await generateVenues(prisma, config, leafNodeIds);

            const participantIds = await generateParticipants(prisma, config, venueIds);

            const { activityTypeIds, roleIds } = await getPredefinedData(prisma);
            console.log(`Found ${activityTypeIds.length} activity types and ${roleIds.length} roles`);

            await generateActivities(prisma, config, venueIds, participantIds, activityTypeIds, roleIds);

            // Summary
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log('\n=== Generation Complete ===');
            console.log(`Geographic Areas: ${config.geographicAreas.toLocaleString()}`);
            console.log(`Venues: ${config.venues.toLocaleString()}`);
            console.log(`Participants: ${config.participants.toLocaleString()}`);
            console.log(`Activities: ${config.activities.toLocaleString()}`);
            console.log(`Execution time: ${elapsed}s`);
            console.log('===========================\n');
        }
    } catch (error) {
        console.error('\nERROR: Failed to generate fake data');
        if (error instanceof Error) {
            console.error(`Message: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
        } else {
            console.error(error);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
