import request from 'supertest';
import app from '../../index';
import { PrismaClient } from '@prisma/client';
import { TestHelpers } from '../utils';
import { AuthService } from '../../services/auth.service';
import { UserRepository } from '../../repositories/user.repository';

const prisma = new PrismaClient();

describe('Activity Role and Age Cohort Filtering Integration Tests', () => {
  let adminToken: string;
  let testActivityTypeId: string;
  let testActivityCategoryId: string;
  let testVenueId: string;
  let testGeographicAreaId: string;
  let tutorRoleId: string;
  let teacherRoleId: string;
  let participantRoleId: string;

  // Test participants with various ages
  let youthParticipant1Id: string; // Born 2010-01-01 (age ~16, Youth)
  let juniorYouthParticipant1Id: string; // Born 2012-06-15 (age ~13, Junior Youth)
  let adultParticipant1Id: string; // Born 1990-03-20 (age ~36, Adult)
  let unknownAgeParticipantId: string; // No date of birth (Unknown)

  // Test activities
  let activity1Id: string; // Has Youth Tutor
  let activity2Id: string; // Has Junior Youth Teacher
  let activity3Id: string; // Has Adult Tutor
  let activity4Id: string; // Has Unknown age Participant
  let activity5Id: string; // Completed activity with Youth Tutor (ended 2025-12-31)

  let adminUserId: string;

  beforeAll(async () => {
    const testSuffix = `activity-role-age-${Date.now()}`;

    // Create admin user and login
    const adminUser = await TestHelpers.createTestUser(prisma, 'ADMINISTRATOR', testSuffix);
    adminUserId = adminUser.id;

    const userRepo = new UserRepository(prisma);
    const authService = new AuthService(userRepo);

    // Set password for admin user
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash('password123', 10);
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { passwordHash: hashedPassword },
    });

    const loginResult = await authService.login({
      email: adminUser.email,
      password: 'password123',
    });
    adminToken = loginResult.accessToken;

    // Create test geographic area
    const geographicArea = await prisma.geographicArea.create({
      data: {
        name: 'Test City for Activity Filtering',
        areaType: 'CITY',
      },
    });
    testGeographicAreaId = geographicArea.id;

    // Create test venue
    const venue = await prisma.venue.create({
      data: {
        name: 'Test Venue for Activity Filtering',
        address: '123 Test St',
        geographicAreaId: testGeographicAreaId,
        latitude: 40.7128,
        longitude: -74.0060,
      },
    });
    testVenueId = venue.id;

    // Get activity category and type
    const activityCategory = await prisma.activityCategory.findFirst({
      where: { name: 'Study Circles' },
    });
    if (!activityCategory) throw new Error('Activity category not found');
    testActivityCategoryId = activityCategory.id;

    const activityType = await prisma.activityType.findFirst({
      where: { activityCategoryId: testActivityCategoryId },
    });
    if (!activityType) throw new Error('Activity type not found');
    testActivityTypeId = activityType.id;

    // Get roles
    const tutorRole = await TestHelpers.getPredefinedRole(prisma, 'Tutor');
    tutorRoleId = tutorRole.id;

    const teacherRole = await TestHelpers.getPredefinedRole(prisma, 'Teacher');
    teacherRoleId = teacherRole.id;

    const participantRole = await TestHelpers.getPredefinedRole(prisma, 'Participant');
    participantRoleId = participantRole.id;

    // Create test participants with various ages
    const youthParticipant1 = await prisma.participant.create({
      data: {
        name: 'Youth Participant 1',
        email: 'youth1@test.com',
        dateOfBirth: new Date('2010-01-01'), // ~16 years old (Youth)
      },
    });
    youthParticipant1Id = youthParticipant1.id;

    const juniorYouthParticipant1 = await prisma.participant.create({
      data: {
        name: 'Junior Youth Participant 1',
        email: 'jy1@test.com',
        dateOfBirth: new Date('2012-06-15'), // ~13 years old (Junior Youth)
      },
    });
    juniorYouthParticipant1Id = juniorYouthParticipant1.id;

    const adultParticipant1 = await prisma.participant.create({
      data: {
        name: 'Adult Participant 1',
        email: 'adult1@test.com',
        dateOfBirth: new Date('1990-03-20'), // ~36 years old (Adult)
      },
    });
    adultParticipant1Id = adultParticipant1.id;

    const unknownAgeParticipant = await prisma.participant.create({
      data: {
        name: 'Unknown Age Participant',
        email: 'unknown@test.com',
        dateOfBirth: null, // Unknown age cohort
      },
    });
    unknownAgeParticipantId = unknownAgeParticipant.id;

    // Create test activities
    const activity1 = await prisma.activity.create({
      data: {
        name: 'Activity 1 - Youth Tutor',
        activityTypeId: testActivityTypeId,
        startDate: new Date('2025-01-01'),
        endDate: null, // Ongoing
        status: 'ACTIVE',
      },
    });
    activity1Id = activity1.id;

    const activity2 = await prisma.activity.create({
      data: {
        name: 'Activity 2 - Junior Youth Teacher',
        activityTypeId: testActivityTypeId,
        startDate: new Date('2025-02-01'),
        endDate: null, // Ongoing
        status: 'ACTIVE',
      },
    });
    activity2Id = activity2.id;

    const activity3 = await prisma.activity.create({
      data: {
        name: 'Activity 3 - Adult Tutor',
        activityTypeId: testActivityTypeId,
        startDate: new Date('2025-03-01'),
        endDate: null, // Ongoing
        status: 'ACTIVE',
      },
    });
    activity3Id = activity3.id;

    const activity4 = await prisma.activity.create({
      data: {
        name: 'Activity 4 - Unknown Age Participant',
        activityTypeId: testActivityTypeId,
        startDate: new Date('2025-04-01'),
        endDate: null, // Ongoing
        status: 'ACTIVE',
      },
    });
    activity4Id = activity4.id;

    const activity5 = await prisma.activity.create({
      data: {
        name: 'Activity 5 - Completed Youth Tutor',
        activityTypeId: testActivityTypeId,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'), // Completed
        status: 'COMPLETED',
      },
    });
    activity5Id = activity5.id;

    // Create venue associations for all activities
    for (const activityId of [activity1Id, activity2Id, activity3Id, activity4Id, activity5Id]) {
      await prisma.activityVenueHistory.create({
        data: {
          activityId,
          venueId: testVenueId,
          effectiveFrom: null, // Uses activity start date
        },
      });
    }

    // Create assignments
    // Activity 1: Youth Tutor
    await prisma.assignment.create({
      data: {
        activityId: activity1Id,
        participantId: youthParticipant1Id,
        roleId: tutorRoleId,
      },
    });

    // Activity 2: Junior Youth Teacher
    await prisma.assignment.create({
      data: {
        activityId: activity2Id,
        participantId: juniorYouthParticipant1Id,
        roleId: teacherRoleId,
      },
    });

    // Activity 3: Adult Tutor
    await prisma.assignment.create({
      data: {
        activityId: activity3Id,
        participantId: adultParticipant1Id,
        roleId: tutorRoleId,
      },
    });

    // Activity 4: Unknown Age Participant
    await prisma.assignment.create({
      data: {
        activityId: activity4Id,
        participantId: unknownAgeParticipantId,
        roleId: participantRoleId,
      },
    });

    // Activity 5: Youth Tutor (completed)
    await prisma.assignment.create({
      data: {
        activityId: activity5Id,
        participantId: youthParticipant1Id,
        roleId: tutorRoleId,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.assignment.deleteMany({
      where: {
        activityId: {
          in: [activity1Id, activity2Id, activity3Id, activity4Id, activity5Id],
        },
      },
    });

    await prisma.activityVenueHistory.deleteMany({
      where: {
        activityId: {
          in: [activity1Id, activity2Id, activity3Id, activity4Id, activity5Id],
        },
      },
    });

    await prisma.activity.deleteMany({
      where: {
        id: {
          in: [activity1Id, activity2Id, activity3Id, activity4Id, activity5Id],
        },
      },
    });

    await prisma.participant.deleteMany({
      where: {
        id: {
          in: [
            youthParticipant1Id,
            juniorYouthParticipant1Id,
            adultParticipant1Id,
            unknownAgeParticipantId,
          ],
        },
      },
    });

    await prisma.venue.deleteMany({
      where: { id: testVenueId },
    });

    await prisma.geographicArea.deleteMany({
      where: { id: testGeographicAreaId },
    });

    await prisma.user.deleteMany({
      where: { id: adminUserId },
    });

    await prisma.$disconnect();
  });

  describe('Role Filtering', () => {
    it('should filter activities by single role (Tutor)', async () => {
      const response = await request(app)
        .get(`/api/v1/activities?filter[roleIds]=${tutorRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      const activityIds = response.body.data.map((a: any) => a.id);
      expect(activityIds).toContain(activity1Id); // Youth Tutor
      expect(activityIds).toContain(activity3Id); // Adult Tutor
      expect(activityIds).toContain(activity5Id); // Completed Youth Tutor
      expect(activityIds).not.toContain(activity2Id); // Junior Youth Teacher
      expect(activityIds).not.toContain(activity4Id); // Unknown Age Participant
    });

    it('should filter activities by multiple roles (Tutor, Teacher)', async () => {
      const response = await request(app)
        .get(`/api/v1/activities?filter[roleIds]=${tutorRoleId},${teacherRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      // Should include activities with Tutors OR Teachers
      expect(activityIds).toContain(activity1Id); // Youth Tutor
      expect(activityIds).toContain(activity2Id); // Junior Youth Teacher
      expect(activityIds).toContain(activity3Id); // Adult Tutor
      expect(activityIds).toContain(activity5Id); // Completed Youth Tutor
      expect(activityIds).not.toContain(activity4Id); // Unknown Age Participant
    });

    it('should return empty array when no activities match role filter', async () => {
      // Use a non-existent role ID
      const fakeRoleId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/v1/activities?filter[roleIds]=${fakeRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });
  });

  describe('Age Cohort Filtering', () => {
    it('should filter activities by single age cohort (Youth)', async () => {
      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=Youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      expect(activityIds).toContain(activity1Id); // Youth Tutor
      expect(activityIds).toContain(activity5Id); // Completed Youth Tutor
      expect(activityIds).not.toContain(activity2Id); // Junior Youth Teacher
      expect(activityIds).not.toContain(activity3Id); // Adult Tutor
      expect(activityIds).not.toContain(activity4Id); // Unknown Age
    });

    it('should filter activities by multiple age cohorts (Youth, Junior Youth)', async () => {
      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=Youth,Junior Youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      // Should include activities with Youth OR Junior Youth participants
      expect(activityIds).toContain(activity1Id); // Youth Tutor
      expect(activityIds).toContain(activity2Id); // Junior Youth Teacher
      expect(activityIds).toContain(activity5Id); // Completed Youth Tutor
      expect(activityIds).not.toContain(activity3Id); // Adult Tutor
      expect(activityIds).not.toContain(activity4Id); // Unknown Age
    });

    it('should filter activities by Unknown age cohort', async () => {
      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=Unknown')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      expect(activityIds).toContain(activity4Id); // Unknown Age Participant
      expect(activityIds).not.toContain(activity1Id); // Youth
      expect(activityIds).not.toContain(activity2Id); // Junior Youth
      expect(activityIds).not.toContain(activity3Id); // Adult
    });

    it('should use reference date for age cohort calculation with date range filter', async () => {
      // Filter with endDate in the past
      // This tests that the reference date calculation works correctly
      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=Youth&filter[endDate]=2025-06-30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      // Should include activities with participants who were Youth on 2025-06-30
      expect(activityIds).toContain(activity1Id); // Youth on 2025-06-30
      expect(activityIds).toContain(activity5Id); // Youth on 2025-06-30
    });
  });

  describe('Combined Role and Age Cohort Filtering', () => {
    it('should filter activities by role AND age cohort', async () => {
      const response = await request(app)
        .get(`/api/v1/activities?filter[roleIds]=${tutorRoleId}&filter[ageCohorts]=Youth`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      // Should only include activities with Youth Tutors
      expect(activityIds).toContain(activity1Id); // Youth Tutor
      expect(activityIds).toContain(activity5Id); // Completed Youth Tutor
      expect(activityIds).not.toContain(activity2Id); // Junior Youth Teacher (not Tutor)
      expect(activityIds).not.toContain(activity3Id); // Adult Tutor (not Youth)
      expect(activityIds).not.toContain(activity4Id); // Unknown Age Participant
    });

    it('should combine role, age cohort, and activity type filters with AND logic', async () => {
      const response = await request(app)
        .get(`/api/v1/activities?filter[roleIds]=${tutorRoleId}&filter[ageCohorts]=Youth&filter[activityTypeIds]=${testActivityTypeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      // Should include activities matching ALL criteria
      expect(activityIds).toContain(activity1Id); // Youth Tutor of correct type
      expect(activityIds).toContain(activity5Id); // Completed Youth Tutor of correct type
    });
  });

  describe('Pagination with Participant Filters', () => {
    it('should return correct total count with role filter', async () => {
      const response = await request(app)
        .get(`/api/v1/activities?filter[roleIds]=${tutorRoleId}&page=1&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(3); // Activities 1, 3, and 5 have Tutors
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should return correct total count with age cohort filter', async () => {
      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=Youth&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2); // Activities 1 and 5 have Youth participants
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid role ID format', async () => {
      const response = await request(app)
        .get('/api/v1/activities?filter[roleIds]=invalid-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Invalid role ID format');
    });

    it('should return 400 for invalid age cohort name', async () => {
      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=InvalidCohort')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Invalid age cohort');
    });
  });

  describe('No Duplicate Activities', () => {
    it('should not return duplicate activities when multiple participants match', async () => {
      // Add another Youth participant to activity1
      const youthParticipant2 = await prisma.participant.create({
        data: {
          name: 'Youth Participant 2',
          email: 'youth2@test.com',
          dateOfBirth: new Date('2009-05-10'), // Youth
        },
      });

      await prisma.assignment.create({
        data: {
          activityId: activity1Id,
          participantId: youthParticipant2.id,
          roleId: tutorRoleId,
        },
      });

      const response = await request(app)
        .get('/api/v1/activities?filter[ageCohorts]=Youth')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const activityIds = response.body.data.map((a: any) => a.id);

      // Activity1 should appear only once, not twice
      const activity1Count = activityIds.filter((id: string) => id === activity1Id).length;
      expect(activity1Count).toBe(1);

      // Clean up
      await prisma.assignment.deleteMany({
        where: { participantId: youthParticipant2.id },
      });
      await prisma.participant.delete({
        where: { id: youthParticipant2.id },
      });
    });
  });
});
