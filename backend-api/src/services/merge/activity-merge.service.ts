import { Activity, Prisma } from '@prisma/client';
import { MergeService } from '../../types/merge.types';
import { AppError } from '../../types/errors.types';
import { getPrismaClient } from '../../utils/prisma.client';

const prisma = getPrismaClient();

/**
 * Service for merging activity records
 * Handles migration of assignments and venue history
 */
export class ActivityMergeService implements MergeService<Activity> {
  /**
   * Merge source activity into destination activity
   * @param sourceId - ID of activity to merge from (will be deleted)
   * @param destinationId - ID of activity to merge into (will be updated)
   * @param reconciledFields - Optional field updates for destination activity
   * @returns Updated destination activity
   * @throws AppError if merge fails
   */
  async merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<Activity>
  ): Promise<Activity> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Validate records exist
      await this.validateRecord(tx, sourceId);
      await this.validateRecord(tx, destinationId);

      // Step 2: Update destination with reconciled fields (if provided)
      if (reconciledFields) {
        await this.updateDestination(tx, destinationId, reconciledFields);
      }

      // Step 3: Migrate related entities
      await this.migrateAssignments(tx, sourceId, destinationId);
      await this.migrateVenueHistory(tx, sourceId, destinationId);

      // Step 4: Delete source record
      await this.deleteSource(tx, sourceId);

      // Step 5: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }

  /**
   * Validate that an activity record exists
   */
  private async validateRecord(
    tx: Prisma.TransactionClient,
    activityId: string
  ): Promise<Activity> {
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new AppError(
        'RECORD_NOT_FOUND',
        `Activity with ID ${activityId} not found`,
        400
      );
    }

    return activity;
  }

  /**
   * Update destination activity with reconciled fields
   */
  private async updateDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
    reconciledFields: Partial<Activity>
  ): Promise<void> {
    // Remove fields that shouldn't be updated
    const { id, createdAt, updatedAt, version, ...updateData } = reconciledFields as any;

    await tx.activity.update({
      where: { id: destinationId },
      data: updateData,
    });
  }

  /**
   * Migrate assignments from source to destination
   * Removes duplicates with same participantId and roleId
   */
  private async migrateAssignments(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate assignments that don't create duplicates
    await tx.$executeRaw`
      UPDATE assignments
      SET "activityId" = ${destinationId}
      WHERE "activityId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM assignments a2
          WHERE a2."activityId" = ${destinationId}
            AND a2."participantId" = assignments."participantId"
            AND a2."roleId" = assignments."roleId"
        )
    `;

    // Delete remaining duplicate assignments
    await tx.$executeRaw`
      DELETE FROM assignments
      WHERE "activityId" = ${sourceId}
    `;
  }

  /**
   * Migrate venue history from source to destination
   * Removes duplicates with same venueId and effectiveFrom
   */
  private async migrateVenueHistory(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate venue history records that don't create duplicates
    await tx.$executeRaw`
      UPDATE activity_venue_history
      SET "activityId" = ${destinationId}
      WHERE "activityId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM activity_venue_history avh2
          WHERE avh2."activityId" = ${destinationId}
            AND avh2."venueId" = activity_venue_history."venueId"
            AND (
              (avh2."effectiveFrom" IS NULL AND activity_venue_history."effectiveFrom" IS NULL)
              OR avh2."effectiveFrom" = activity_venue_history."effectiveFrom"
            )
        )
    `;

    // Delete remaining duplicate venue history records
    await tx.$executeRaw`
      DELETE FROM activity_venue_history
      WHERE "activityId" = ${sourceId}
    `;
  }

  /**
   * Delete source activity record
   */
  private async deleteSource(
    tx: Prisma.TransactionClient,
    sourceId: string
  ): Promise<void> {
    await tx.activity.delete({
      where: { id: sourceId },
    });
  }

  /**
   * Fetch updated destination activity
   */
  private async fetchDestination(
    tx: Prisma.TransactionClient,
    destinationId: string
  ): Promise<Activity> {
    const activity = await tx.activity.findUnique({
      where: { id: destinationId },
    });

    if (!activity) {
      throw new AppError(
        'MERGE_FAILED',
        `Destination activity not found after merge`,
        500
      );
    }

    return activity;
  }
}
