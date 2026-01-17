import { PrismaClient } from '@prisma/client';
import { GeographicAreaService } from '../../services/geographic-area.service';
import { GeographicAreaRepository } from '../../repositories/geographic-area.repository';
import { GeographicAuthorizationService } from '../../services/geographic-authorization.service';
import { UserGeographicAuthorizationRepository } from '../../repositories/user-geographic-authorization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { getPrismaClient } from '../../utils/prisma.client';

describe('Geographic Area Batch Endpoints Integration Tests', () => {
  let prisma: PrismaClient;
  let service: GeographicAreaService;
  let repository: GeographicAreaRepository;
  let authService: GeographicAuthorizationService;
  let authRepo: UserGeographicAuthorizationRepository;
  let userRepo: UserRepository;
  let testUserId: string;
  let countryId: string;
  let provinceId: string;
  let cityId: string;
  let neighbourhoodId: string;

  beforeAll(async () => {
    prisma = getPrismaClient();
    repository = new GeographicAreaRepository(prisma);
    authRepo = new UserGeographicAuthorizationRepository(prisma);
    userRepo = new UserRepository(prisma);
    authService = new GeographicAuthorizationService(authRepo, repository, userRepo);
    service = new GeographicAreaService(repository, prisma, authService);

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'batch-test@test.com',
        passwordHash: 'hash',
        role: 'EDITOR',
      },
    });
    testUserId = user.id;

    // Create test geographic hierarchy
    // Country (root)
    const country = await repository.create({
      name: 'Batch Test Country',
      areaType: 'COUNTRY',
    });
    countryId = country.id;

    // Province (child of country)
    const province = await repository.create({
      name: 'Batch Test Province',
      areaType: 'PROVINCE',
      parentGeographicAreaId: countryId,
    });
    provinceId = province.id;

    // City (child of province)
    const city = await repository.create({
      name: 'Batch Test City',
      areaType: 'CITY',
      parentGeographicAreaId: provinceId,
    });
    cityId = city.id;

    // Neighbourhood (child of city)
    const neighbourhood = await repository.create({
      name: 'Batch Test Neighbourhood',
      areaType: 'NEIGHBOURHOOD',
      parentGeographicAreaId: cityId,
    });
    neighbourhoodId = neighbourhood.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.geographicArea.deleteMany({
      where: {
        id: { in: [neighbourhoodId, cityId, provinceId, countryId] },
      },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('getBatchAncestors', () => {
    it('should fetch ancestors for multiple areas in a single request', async () => {
      const result = await service.getBatchAncestors([neighbourhoodId, cityId]);

      expect(result).toBeDefined();

      // Neighbourhood should have city as parent
      const neighbourhoodParent = result[neighbourhoodId];
      expect(neighbourhoodParent).toBe(cityId);

      // City should have province as parent
      const cityParent = result[cityId];
      expect(cityParent).toBe(provinceId);
    });

    it('should return null for top-level areas', async () => {
      const result = await service.getBatchAncestors([countryId]);

      expect(result).toBeDefined();
      expect(result[countryId]).toBeNull();
    });

    it('should throw error for invalid UUID', async () => {
      await expect(
        service.getBatchAncestors(['invalid-uuid'])
      ).rejects.toThrow('Invalid UUID format');
    });

    it('should throw error when more than 100 area IDs provided', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) =>
        `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
      );

      await expect(
        service.getBatchAncestors(tooManyIds)
      ).rejects.toThrow('100');
    });
  });

  describe('getBatchDetails', () => {
    it('should fetch complete details for multiple areas in a single request', async () => {
      const result = await service.getBatchDetails([neighbourhoodId, cityId, provinceId]);

      expect(result).toBeDefined();

      // Check neighbourhood details
      const neighbourhood = result[neighbourhoodId];
      expect(neighbourhood).toBeDefined();
      expect(neighbourhood.id).toBe(neighbourhoodId);
      expect(neighbourhood.name).toBe('Batch Test Neighbourhood');
      expect(neighbourhood.areaType).toBe('NEIGHBOURHOOD');
      expect(neighbourhood.parentGeographicAreaId).toBe(cityId);
      expect(neighbourhood.childCount).toBe(0);
      expect(neighbourhood.createdAt).toBeDefined();
      expect(neighbourhood.updatedAt).toBeDefined();

      // Check city details
      const city = result[cityId];
      expect(city).toBeDefined();
      expect(city.id).toBe(cityId);
      expect(city.name).toBe('Batch Test City');
      expect(city.areaType).toBe('CITY');
      expect(city.parentGeographicAreaId).toBe(provinceId);
      expect(city.childCount).toBe(1); // Has neighbourhood as child
      expect(city.createdAt).toBeDefined();
      expect(city.updatedAt).toBeDefined();

      // Check province details
      const province = result[provinceId];
      expect(province).toBeDefined();
      expect(province.id).toBe(provinceId);
      expect(province.name).toBe('Batch Test Province');
      expect(province.areaType).toBe('PROVINCE');
      expect(province.parentGeographicAreaId).toBe(countryId);
      expect(province.childCount).toBe(1); // Has city as child
    });

    it('should omit non-existent area IDs from response', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const result = await service.getBatchDetails([cityId, nonExistentId]);

      expect(result).toBeDefined();
      expect(result[cityId]).toBeDefined();
      expect(result[nonExistentId]).toBeUndefined();
    });

    it('should throw error for empty areaIds array', async () => {
      await expect(
        service.getBatchDetails([])
      ).rejects.toThrow('Must provide between 1 and 100 area IDs');
    });

    it('should throw error for invalid UUID', async () => {
      await expect(
        service.getBatchDetails(['invalid-uuid'])
      ).rejects.toThrow('Invalid UUID format');
    });

    it('should throw error when more than 100 area IDs provided', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) =>
        `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
      );

      await expect(
        service.getBatchDetails(tooManyIds)
      ).rejects.toThrow('100');
    });

    it('should work together with batch-ancestors for efficient two-step fetching', async () => {
      // Step 1: Fetch ancestor parent map using batch-ancestors
      const ancestorsMap = await service.getBatchAncestors([neighbourhoodId]);

      expect(ancestorsMap).toBeDefined();
      expect(ancestorsMap[neighbourhoodId]).toBe(cityId);

      // Step 2: Collect all unique ancestor IDs by traversing the parent map
      const ancestorIds = new Set<string>();
      let currentId: string | null = neighbourhoodId;

      while (currentId && ancestorsMap[currentId]) {
        const parentId: string | null = ancestorsMap[currentId];
        if (parentId) {
          ancestorIds.add(parentId);
          currentId = parentId;
        } else {
          break;
        }
      }

      // Step 3: Fetch full details for all ancestors using batch-details
      const detailsResult = await service.getBatchDetails(Array.from(ancestorIds));

      expect(detailsResult).toBeDefined();

      // Verify we got complete details for all ancestors
      expect(detailsResult[cityId]).toBeDefined();
      expect(detailsResult[cityId].name).toBe('Batch Test City');
      expect(detailsResult[cityId].childCount).toBe(1);

      expect(detailsResult[provinceId]).toBeDefined();
      expect(detailsResult[provinceId].name).toBe('Batch Test Province');

      expect(detailsResult[countryId]).toBeDefined();
      expect(detailsResult[countryId].name).toBe('Batch Test Country');
    });
  });

  describe('Authorization Filtering', () => {
    let restrictedUserId: string;
    let allowedCityId: string;
    let deniedCityId: string;

    beforeAll(async () => {
      // Create a restricted user
      const user = await prisma.user.create({
        data: {
          email: 'batch-restricted@test.com',
          passwordHash: 'hash',
          role: 'EDITOR',
        },
      });
      restrictedUserId = user.id;

      // Create two cities: one allowed, one denied
      const allowedCity = await repository.create({
        name: 'Batch Allowed City',
        areaType: 'CITY',
        parentGeographicAreaId: provinceId,
      });
      allowedCityId = allowedCity.id;

      const deniedCity = await repository.create({
        name: 'Batch Denied City',
        areaType: 'CITY',
        parentGeographicAreaId: provinceId,
      });
      deniedCityId = deniedCity.id;

      // Add ALLOW rule for allowed city
      await authRepo.create({
        userId: restrictedUserId,
        geographicAreaId: allowedCityId,
        ruleType: 'ALLOW',
        createdBy: testUserId,
      });

      // Add DENY rule for denied city
      await authRepo.create({
        userId: restrictedUserId,
        geographicAreaId: deniedCityId,
        ruleType: 'DENY',
        createdBy: testUserId,
      });
    });

    afterAll(async () => {
      // Clean up
      await prisma.userGeographicAuthorization.deleteMany({
        where: { userId: restrictedUserId },
      });
      await prisma.geographicArea.deleteMany({
        where: { id: { in: [allowedCityId, deniedCityId] } },
      });
      await prisma.user.delete({
        where: { id: restrictedUserId },
      });
    });

    it('should omit unauthorized areas from batch-details response', async () => {
      const result = await service.getBatchDetails(
        [allowedCityId, deniedCityId, provinceId],
        restrictedUserId,
        'EDITOR'
      );

      expect(result).toBeDefined();

      // Should include allowed city
      expect(result[allowedCityId]).toBeDefined();
      expect(result[allowedCityId].name).toBe('Batch Allowed City');

      // Should NOT include denied city
      expect(result[deniedCityId]).toBeUndefined();

      // Should include province (ancestor of allowed city, read-only access)
      expect(result[provinceId]).toBeDefined();
      expect(result[provinceId].name).toBe('Batch Test Province');
    });

    it('should filter batch-ancestors response based on authorization', async () => {
      const result = await service.getBatchAncestors(
        [allowedCityId, deniedCityId],
        restrictedUserId,
        'EDITOR'
      );

      expect(result).toBeDefined();

      // Should include parent for allowed city
      expect(result[allowedCityId]).toBe(provinceId);

      // Should NOT include denied city in result
      expect(result[deniedCityId]).toBeUndefined();
    });

    it('should allow administrators to bypass authorization filtering', async () => {
      const result = await service.getBatchDetails(
        [allowedCityId, deniedCityId],
        testUserId,
        'ADMINISTRATOR'
      );

      expect(result).toBeDefined();

      // Admin should see both cities
      expect(result[allowedCityId]).toBeDefined();
      expect(result[deniedCityId]).toBeDefined();
    });
  });
});
