import { Population, Prisma } from '@prisma/client';
import { MergeService } from '../../types/merge.types';
import { AppError } from '../../types/errors.types';
import { getPrismaClient } from '../../utils/prisma.client';

const prisma = getPrismaClient();

/**
 * Service for merging population records
 * Handles migration of participant population memberships (simple entity - no field reconciliation)
 */
export class PopulationMergeService implements MergeService<Population> {
  /**
   * Merge source population into destination population
   * @param sourceId - ID of population to merge from (will be deleted)
   * @param destinationId - ID of population to merge into
   * @param _reconciledFields - Not used for simple entities
   * @returns Updated destination population
   * @throws AppError if merge fails
   */
  async merge(
    sourceId: string,
    destinationId: string,
    _reconciledFields?: Partial<Population>
  ): Promise<Population> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Validate records exist
      await this.validateRecord(tx, sourceId);
      await this.validateRecord(tx, destinationId);

      // Step 2: Migrate related entities
      await this.migrateParticipantPopulations(tx, sourceId, destinationId);

      // Step 3: Delete source record
      await this.deleteSource(tx, sourceId);

      // Step 4: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }

  /**
   * Validate that a population record exists
   */
  private async validateRecord(
    tx: Prisma.TransactionClient,
    populationId: string
  ): Promise<Population> {
    const population = await tx.population.findUnique({
      where: { id: populationId },
    });

    if (!population) {
      throw new AppError(
        'RECORD_NOT_FOUND',
        `Population with ID ${populationId} not found`,
        400
      );
    }

    return population;
  }

  /**
   * Migrate participant populations from source to destination
   * Removes duplicates with same participantId
   */
  private async migrateParticipantPopulations(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate participant populations that don't create duplicates
    await tx.$executeRaw`
      UPDATE participant_populations
      SET "populationId" = ${destinationId}
      WHERE "populationId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM participant_populations pp2
          WHERE pp2."populationId" = ${destinationId}
            AND pp2."participantId" = participant_populations."participantId"
        )
    `;

    // Delete remaining duplicate participant populations
    await tx.$executeRaw`
      DELETE FROM participant_populations
      WHERE "populationId" = ${sourceId}
    `;
  }

  /**
   * Delete source population record
   */
  private async deleteSource(
    tx: Prisma.TransactionClient,
    sourceId: string
  ): Promise<void> {
    await tx.population.delete({
      where: { id: sourceId },
    });
  }

  /**
   * Fetch updated destination population
   */
  private async fetchDestination(
    tx: Prisma.TransactionClient,
    destinationId: string
  ): Promise<Population> {
    const population = await tx.population.findUnique({
      where: { id: destinationId },
    });

    if (!population) {
      throw new AppError(
        'MERGE_FAILED',
        `Destination population not found after merge`,
        500
      );
    }

    return population;
  }
}
