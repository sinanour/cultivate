import { Venue, Prisma } from '@prisma/client';
import { MergeService } from '../../types/merge.types';
import { AppError } from '../../types/errors.types';
import { getPrismaClient } from '../../utils/prisma.client';

const prisma = getPrismaClient();

/**
 * Service for merging venue records
 * Handles migration of activity venue history and participant address history
 */
export class VenueMergeService implements MergeService<Venue> {
  /**
   * Merge source venue into destination venue
   * @param sourceId - ID of venue to merge from (will be deleted)
   * @param destinationId - ID of venue to merge into (will be updated)
   * @param reconciledFields - Optional field updates for destination venue
   * @returns Updated destination venue
   * @throws AppError if merge fails
   */
  async merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<Venue>
  ): Promise<Venue> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Validate records exist
      await this.validateRecord(tx, sourceId);
      await this.validateRecord(tx, destinationId);

      // Step 2: Update destination with reconciled fields (if provided)
      if (reconciledFields) {
        await this.updateDestination(tx, destinationId, reconciledFields);
      }

      // Step 3: Migrate related entities
      await this.migrateActivityVenueHistory(tx, sourceId, destinationId);
      await this.migrateParticipantAddressHistory(tx, sourceId, destinationId);

      // Step 4: Delete source record
      await this.deleteSource(tx, sourceId);

      // Step 5: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }

  /**
   * Validate that a venue record exists
   */
  private async validateRecord(
    tx: Prisma.TransactionClient,
    venueId: string
  ): Promise<Venue> {
    const venue = await tx.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      throw new AppError(
        'RECORD_NOT_FOUND',
        `Venue with ID ${venueId} not found`,
        400
      );
    }

    return venue;
  }

  /**
   * Update destination venue with reconciled fields
   */
  private async updateDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
    reconciledFields: Partial<Venue>
  ): Promise<void> {
    // Remove fields that shouldn't be updated
    const { id, createdAt, updatedAt, version, ...updateData } = reconciledFields as any;

    await tx.venue.update({
      where: { id: destinationId },
      data: updateData,
    });
  }

  /**
   * Migrate activity venue history from source to destination
   * Removes duplicates with same activityId and effectiveFrom
   */
  private async migrateActivityVenueHistory(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate activity venue history records that don't create duplicates
    await tx.$executeRaw`
      UPDATE activity_venue_history
      SET "venueId" = ${destinationId}
      WHERE "venueId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM activity_venue_history avh2
          WHERE avh2."venueId" = ${destinationId}
            AND avh2."activityId" = activity_venue_history."activityId"
            AND (
              (avh2."effectiveFrom" IS NULL AND activity_venue_history."effectiveFrom" IS NULL)
              OR avh2."effectiveFrom" = activity_venue_history."effectiveFrom"
            )
        )
    `;

    // Delete remaining duplicate activity venue history records
    await tx.$executeRaw`
      DELETE FROM activity_venue_history
      WHERE "venueId" = ${sourceId}
    `;
  }

  /**
   * Migrate participant address history from source to destination
   * Removes duplicates with same participantId and effectiveFrom
   */
  private async migrateParticipantAddressHistory(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate participant address history records that don't create duplicates
    await tx.$executeRaw`
      UPDATE participant_address_history
      SET "venueId" = ${destinationId}
      WHERE "venueId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM participant_address_history pah2
          WHERE pah2."venueId" = ${destinationId}
            AND pah2."participantId" = participant_address_history."participantId"
            AND (
              (pah2."effectiveFrom" IS NULL AND participant_address_history."effectiveFrom" IS NULL)
              OR pah2."effectiveFrom" = participant_address_history."effectiveFrom"
            )
        )
    `;

    // Delete remaining duplicate participant address history records
    await tx.$executeRaw`
      DELETE FROM participant_address_history
      WHERE "venueId" = ${sourceId}
    `;
  }

  /**
   * Delete source venue record
   */
  private async deleteSource(
    tx: Prisma.TransactionClient,
    sourceId: string
  ): Promise<void> {
    await tx.venue.delete({
      where: { id: sourceId },
    });
  }

  /**
   * Fetch updated destination venue
   */
  private async fetchDestination(
    tx: Prisma.TransactionClient,
    destinationId: string
  ): Promise<Venue> {
    const venue = await tx.venue.findUnique({
      where: { id: destinationId },
    });

    if (!venue) {
      throw new AppError(
        'MERGE_FAILED',
        `Destination venue not found after merge`,
        500
      );
    }

    return venue;
  }
}
