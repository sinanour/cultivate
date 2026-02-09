import { PrismaClient } from '@prisma/client';
import { MapDataService } from '../src/services/map-data.service';
import { GeographicAreaRepository } from '../src/repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../src/services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../src/repositories/user-geographic-authorization.repository';
import { UserRepository } from '../src/repositories/user.repository';

const prisma = new PrismaClient();

interface BenchmarkResult {
  scenario: string;
  executionTime: number;
  rowsReturned: number;
  totalCount: number;
  queryVariant: string;
}

async function runBenchmark() {
  console.log('🚀 Map Query Performance Benchmark\n');

  // Initialize services
  const geographicAreaRepository = new GeographicAreaRepository(prisma);
  const userGeoAuthRepository = new UserGeographicAuthorizationRepository(prisma);
  const userRepository = new UserRepository(prisma);
  const geoAuthService = new GeographicAuthorizationService(
    userGeoAuthRepository,
    geographicAreaRepository,
    userRepository
  );
  const mapDataService = new MapDataService(prisma, geoAuthService);

  // Get or create test user
  const testUser = await prisma.user.findFirst({
    where: { role: 'ADMINISTRATOR' },
  });

  if (!testUser) {
    console.error('❌ No administrator user found. Please seed the database first.');
    process.exit(1);
  }

  const userId = testUser.id;

  // Count total activities
  const totalActivities = await prisma.activity.count();
  console.log(`📊 Total activities in database: ${totalActivities}\n`);

  if (totalActivities < 1000) {
    console.log('⚠️  Warning: Dataset is small. For meaningful benchmarks, generate more data:');
    console.log('   npm run generate-fake-data -- --activities=10000\n');
  }

  const results: BenchmarkResult[] = [];

  // Scenario 1: No filters (base query)
  console.log('Testing Scenario 1: No filters (base query)...');
  await benchmarkScenario(
    'No filters',
    mapDataService,
    userId,
    {},
    undefined,
    results
  );

  // Scenario 2: With bounding box
  console.log('Testing Scenario 2: With bounding box...');
  await benchmarkScenario(
    'With bounding box',
    mapDataService,
    userId,
    {},
    { minLat: 40, maxLat: 50, minLon: -120, maxLon: -110 },
    results
  );

  // Scenario 3: With population filter (if populations exist)
  const populations = await prisma.population.findMany({ take: 1 });
  if (populations.length > 0) {
    console.log('Testing Scenario 3: With population filter...');
    await benchmarkScenario(
      'With population filter',
      mapDataService,
      userId,
      { populationIds: [populations[0].id] },
      undefined,
      results
    );
  }

  // Scenario 4: With geographic filter (if areas exist)
  const areas = await prisma.geographicArea.findMany({ take: 1 });
  if (areas.length > 0) {
    console.log('Testing Scenario 4: With geographic filter...');
    await benchmarkScenario(
      'With geographic filter',
      mapDataService,
      userId,
      { geographicAreaIds: [areas[0].id] },
      undefined,
      results
    );
  }

  // Scenario 5: Full query (geographic + population)
  if (populations.length > 0 && areas.length > 0) {
    console.log('Testing Scenario 5: Full query (geographic + population)...');
    await benchmarkScenario(
      'Full query',
      mapDataService,
      userId,
      {
        geographicAreaIds: [areas[0].id],
        populationIds: [populations[0].id]
      },
      undefined,
      results
    );
  }

  // Print results
  console.log('\n📈 Benchmark Results:\n');
  console.log('┌─────────────────────────────┬───────────────┬──────────────┬────────────┬──────────────┐');
  console.log('│ Scenario                    │ Time (ms)     │ Rows         │ Total      │ Variant      │');
  console.log('├─────────────────────────────┼───────────────┼──────────────┼────────────┼──────────────┤');

  for (const result of results) {
    const scenario = result.scenario.padEnd(27);
    const time = result.executionTime.toFixed(2).padStart(13);
    const rows = result.rowsReturned.toString().padStart(12);
    const total = result.totalCount.toString().padStart(10);
    const variant = result.queryVariant.padEnd(12);
    console.log(`│ ${scenario} │ ${time} │ ${rows} │ ${total} │ ${variant} │`);
  }

  console.log('└─────────────────────────────┴───────────────┴──────────────┴────────────┴──────────────┘');

  await prisma.$disconnect();
}

async function benchmarkScenario(
  scenario: string,
  service: MapDataService,
  userId: string,
  filters: any,
  boundingBox: any,
  results: BenchmarkResult[]
) {
  const start = Date.now();
  const result = await service.getActivityMarkers(filters, userId, boundingBox, 1, 100);
  const executionTime = Date.now() - start;

  // Determine query variant based on filters
  let variant = 'base';
  if (filters.populationIds && filters.geographicAreaIds) {
    variant = 'full';
  } else if (filters.populationIds) {
    variant = 'population';
  } else if (filters.geographicAreaIds) {
    variant = 'geographic';
  }

  results.push({
    scenario,
    executionTime,
    rowsReturned: result.data.length,
    totalCount: result.pagination.total,
    queryVariant: variant,
  });
}

// Run benchmark
runBenchmark().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});
