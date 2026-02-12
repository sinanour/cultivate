import { GeographicArea, Prisma } from '@prisma/client';
import { MergeService } from '../../types/merge.types';
import { AppError } from '../../types/errors.types';
import { getPrismaClient } from '../../utils/prisma.client';

const prisma = getPrismaClient();

/**
 * Service for merging geographic area records
 * Handles migration of child geographic areas, venues, and user authorizations
 */
export class GeographicAreaMergeService implements MergeService<GeographicArea> {
  /**
   * Merge source geographic area into destination geographic area
   * @param sourceId - ID of geographic area to merge from (will be deleted)
   * @param destinationId - ID of geographic area to merge into (will be updated)
   * @param reconciledFields - Optional field updates for destination geographic area
   * @returns Updated destination geographic area
   * @throws AppError if merge fails
   */
  async merge(
    sourceId: string,
    destinationId: string,
    reconciledFields?: Partial<GeographicArea>
  ): Promise<GeographicArea> {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Step 1: Validate records exist
      await this.validateRecord(tx, sourceId);
      await this.validateRecord(tx, destinationId);

      // Step 2: Update destination with reconciled fields (if provided)
      if (reconciledFields) {
        await this.updateDestination(tx, destinationId, reconciledFields);
      }

      // Step 3: Migrate related entities
      await this.migrateChildGeographicAreas(tx, sourceId, destinationId);
      await this.migrateVenues(tx, sourceId, destinationId);
      await this.migrateUserAuthorizations(tx, sourceId, destinationId);

      // Step 4: Delete source record
      await this.deleteSource(tx, sourceId);

      // Step 5: Return updated destination
      return await this.fetchDestination(tx, destinationId);
    });
  }

  /**
   * Validate that a geographic area record exists
   */
  private async validateRecord(
    tx: Prisma.TransactionClient,
    geographicAreaId: string
  ): Promise<GeographicArea> {
    const geographicArea = await tx.geographicArea.findUnique({
      where: { id: geographicAreaId },
    });

    if (!geographicArea) {
      throw new AppError(
        'RECORD_NOT_FOUND',
        `Geographic area with ID ${geographicAreaId} not found`,
        400
      );
    }

    return geographicArea;
  }

  /**
   * Update destination geographic area with reconciled fields
   */
  private async updateDestination(
    tx: Prisma.TransactionClient,
    destinationId: string,
    reconciledFields: Partial<GeographicArea>
  ): Promise<void> {
    // Remove fields that shouldn't be updated
    const { id, createdAt, updatedAt, version, ...updateData } = reconciledFields as any;

    await tx.geographicArea.update({
      where: { id: destinationId },
      data: updateData,
    });
  }

  /**
   * Migrate child geographic areas from source to destination
   * Removes duplicates with same name and areaType
   */
  private async migrateChildGeographicAreas(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate child geographic areas that don't create duplicates
    await tx.$executeRaw`
      UPDATE geographic_areas
      SET "parentGeographicAreaId" = ${destinationId}
      WHERE "parentGeographicAreaId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM geographic_areas ga2
          WHERE ga2."parentGeographicAreaId" = ${destinationId}
            AND ga2.name = geographic_areas.name
            AND ga2."areaType" = geographic_areas."areaType"
        )
    `;

    // Delete remaining duplicate child geographic areas
    await tx.$executeRaw`
      DELETE FROM geographic_areas
      WHERE "parentGeographicAreaId" = ${sourceId}
    `;
  }

  /**
   * Migrate venues from source to destination
   * All venues are migrated (no duplicate detection needed)
   */
  private async migrateVenues(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE venues
      SET "geographicAreaId" = ${destinationId}
      WHERE "geographicAreaId" = ${sourceId}
    `;
  }

  /**
   * Migrate user geographic authorizations from source to destination
   * Removes duplicates with same userId
   */
  private async migrateUserAuthorizations(
    tx: Prisma.TransactionClient,
    sourceId: string,
    destinationId: string
  ): Promise<void> {
    // Migrate user authorizations that don't create duplicates
    await tx.$executeRaw`
      UPDATE user_geographic_authorizations
      SET "geographicAreaId" = ${destinationId}
      WHERE "geographicAreaId" = ${sourceId}
        AND NOT EXISTS (
          SELECT 1 FROM user_geographic_authorizations uga2
          WHERE uga2."geographicAreaId" = ${destinationId}
            AND uga2."userId" = user_geographic_authorizations."userId"
        )
    `;

    // Delete remaining duplicate user authorizations
    await tx.$executeRaw`
      DELETE FROM user_geographic_authorizations
      WHERE "geographicAreaId" = ${sourceId}
    `;
  }

  /**
   * Delete source geographic area record
   */
  private async deleteSource(
    tx: Prisma.TransactionClient,
    sourceId: string
  ): Promise<void> {
    await tx.geographicArea.delete({
      where: { id: sourceId },
    });
  }

  /**
   * Fetch updated destination geographic area
   */
  private async fetchDestination(
    tx: Prisma.TransactionClient,
    destinationId: string
  ): Promise<GeographicArea> {
    const geographicArea = await tx.geographicArea.findUnique({
      where: { id: destinationId },
    });

    if (!geographicArea) {
      throw new AppError(
        'MERGE_FAILED',
        `Destination geographic area not found after merge`,
        500
      );
    }

    return geographicArea;
  }
}
