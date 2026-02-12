import { ActivityType, Prisma } from '@prisma/client';
import { MergeService } from '../../types/merge.types';
import { AppError } from '../../types/errors.types';
import { getPrismaClient } from '../../utils/prisma.client';

const prisma = getPrismaClient();

/**
 * Service for merging activity type records
 * Handles migration of activity references (simple entity - no field reconciliation)
 */
export class ActivityTypeMergeService implements MergeService<ActivityType> {
  /**
   * Merge source activity type into destination activity type
   * @param sourceId - ID of activity type to merge from (will be deleted)
   * @param destinationId - ID of activity type to merge into
   * @param _reconciledFields - Not used for simple entities
   * @returns Updated destination activity type
   * @throws AppError if merge fails
   */
  async merge(
    sourceId: string,
    destinationId: string,
    _reconciledFields?: Partial<ActivityType>
  ): Promise<ActivityType> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Validate records exist
      await this.validateRecord(tx, sourceId);
      await this.validateRecord(tx, destinationId);

      // Step 2: Migrate related entities
      await this.migrateActivities(tx, sourceId, destinationId);

      // Step 3: Delete source record
      await this.deleteSource(tx, sourceId);

      // Step 4: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }

  /**
   * Validate that an activity type record exists
   */
  private async validateRecord(
    tx: Prisma.TransactionClient,
    activityTypeId: string
  ): Promise<ActivityType> {
    const activityType = await tx.activityType.findUnique({
      where: { id: activityTypeId },
    });

    if (!activityType) {
      throw new AppError(
        'RECORD_NOT_FOUND',
        `Activity type with ID ${activityTypeId} not found`,
        400
      );
    }

    return activityType;
  }

  /**
   * Migrate activities from source to destination
   * No duplicate detection needed - activities can have the same activity type
   */
  private async migrateActivities(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE activities
      SET "activityTypeId" = ${destinationId}
      WHERE "activityTypeId" = ${sourceId}
    `;
  }

  /**
   * Delete source activity type record
   */
  private async deleteSource(
    tx: Prisma.TransactionClient,
    sourceId: string
  ): Promise<void> {
    await tx.activityType.delete({
      where: { id: sourceId },
    });
  }

  /**
   * Fetch updated destination activity type
   */
  private async fetchDestination(
    tx: Prisma.TransactionClient,
    destinationId: string
  ): Promise<ActivityType> {
    const activityType = await tx.activityType.findUnique({
      where: { id: destinationId },
    });

    if (!activityType) {
      throw new AppError(
        'MERGE_FAILED',
        `Destination activity type not found after merge`,
        500
      );
    }

    return activityType;
  }
}
