import { Participant, Prisma } from '@prisma/client';
import { MergeService } from '../../types/merge.types';
import { AppError } from '../../types/errors.types';
import { getPrismaClient } from '../../utils/prisma.client';

const prisma = getPrismaClient();

/**
 * Service for merging participant records
 * Handles migration of address history, assignments, and population memberships
 */
export class ParticipantMergeService implements MergeService<Participant> {
  /**
   * Merge source participant into destination participant
   * @param sourceId - ID of participant to merge from (will be deleted)
   * @param destinationId - ID of participant to merge into (will be updated)
   * @param reconciledFields - Optional field updates for destination participant
   * @returns Updated destination participant
   * @throws AppError if merge fails
   */
  async merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<Participant>
  ): Promise<Participant> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Validate records exist
      await this.validateRecord(tx, sourceId);
      await this.validateRecord(tx, destinationId);

      // Step 2: Update destination with reconciled fields (if provided)
      if (reconciledFields) {
        await this.updateDestination(tx, destinationId, reconciledFields);
      }

      // Step 3: Migrate related entities
      await this.migrateAddressHistory(tx, sourceId, destinationId);
      await this.migrateAssignments(tx, sourceId, destinationId);
      await this.migratePopulationMemberships(tx, sourceId, destinationId);

      // Step 4: Delete source record
      await this.deleteSource(tx, sourceId);

      // Step 5: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }

  /**
   * Validate that a participant record exists
   */
  private async validateRecord(
    tx: Prisma.TransactionClient,
    participantId: string
  ): Promise<Participant> {
    const participant = await tx.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new AppError(
        'RECORD_NOT_FOUND',
        `Participant with ID ${participantId} not found`,
        400
      );
    }

    return participant;
  }

  /**
   * Update destination participant with reconciled fields
   */
  private async updateDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
    reconciledFields: Partial<Participant>
  ): Promise<void> {
    // Remove fields that shouldn't be updated
    const { id, createdAt, updatedAt, version, ...updateData } = reconciledFields as any;

    await tx.participant.update({
      where: { id: destinationId },
      data: updateData,
    });
  }

  /**
   * Migrate address history from source to destination
   * Removes duplicates with same venueId and effectiveFrom
   */
  private async migrateAddressHistory(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate address history records that don't create duplicates
    await tx.$executeRaw`
      UPDATE participant_address_history
      SET "participantId" = ${destinationId}
      WHERE "participantId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM participant_address_history pah2
          WHERE pah2."participantId" = ${destinationId}
            AND pah2."venueId" = participant_address_history."venueId"
            AND (
              (pah2."effectiveFrom" IS NULL AND participant_address_history."effectiveFrom" IS NULL)
              OR pah2."effectiveFrom" = participant_address_history."effectiveFrom"
            )
        )
    `;

    // Delete remaining duplicate address history records
    await tx.$executeRaw`
      DELETE FROM participant_address_history
      WHERE "participantId" = ${sourceId}
    `;
  }

  /**
   * Migrate assignments from source to destination
   * Removes duplicates with same activityId and roleId
   */
  private async migrateAssignments(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate assignments that don't create duplicates
    await tx.$executeRaw`
      UPDATE assignments
      SET "participantId" = ${destinationId}
      WHERE "participantId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM assignments a2
          WHERE a2."participantId" = ${destinationId}
            AND a2."activityId" = assignments."activityId"
            AND a2."roleId" = assignments."roleId"
        )
    `;

    // Delete remaining duplicate assignments
    await tx.$executeRaw`
      DELETE FROM assignments
      WHERE "participantId" = ${sourceId}
    `;
  }

  /**
   * Migrate population memberships from source to destination
   * Removes duplicates with same populationId
   */
  private async migratePopulationMemberships(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate population memberships that don't create duplicates
    await tx.$executeRaw`
      UPDATE participant_populations
      SET "participantId" = ${destinationId}
      WHERE "participantId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM participant_populations pp2
          WHERE pp2."participantId" = ${destinationId}
            AND pp2."populationId" = participant_populations."populationId"
        )
    `;

    // Delete remaining duplicate population memberships
    await tx.$executeRaw`
      DELETE FROM participant_populations
      WHERE "participantId" = ${sourceId}
    `;
  }

  /**
   * Delete source participant record
   */
  private async deleteSource(
    tx: Prisma.TransactionClient,
    sourceId: string
  ): Promise<void> {
    await tx.participant.delete({
      where: { id: sourceId },
    });
  }

  /**
   * Fetch updated destination participant
   */
  private async fetchDestination(
    tx: Prisma.TransactionClient,
    destinationId: string
  ): Promise<Participant> {
    const participant = await tx.participant.findUnique({
      where: { id: destinationId },
    });

    if (!participant) {
      throw new AppError(
        'MERGE_FAILED',
        `Destination participant not found after merge`,
        500
      );
    }

    return participant;
  }
}
