import { AuthorizationRuleType } from '@prisma/client';
import { UserGeographicAuthorizationRepository } from '../repositories/user-geographic-authorization.repository';
import { GeographicAreaRepository } from '../repositories/geographic-area.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AppError } from '../types/errors.types';

export enum AccessLevel {
    NONE = 'NONE',
    READ_ONLY = 'READ_ONLY',
    FULL = 'FULL',
}

export interface AuthorizedArea {
    geographicAreaId: string;
    geographicAreaName: string;
    areaType: string;
    accessLevel: AccessLevel;
    isDescendant?: boolean;
    isAncestor?: boolean;
}

export interface AuthorizationInfo {
    hasGeographicRestrictions: boolean;
    authorizedAreaIds: string[];  // Areas with FULL access
    readOnlyAreaIds: string[];    // Areas with READ_ONLY access
}

export class GeographicAuthorizationService {
    constructor(
        private authorizationRepository: UserGeographicAuthorizationRepository,
        private geographicAreaRepository: GeographicAreaRepository,
        private userRepository: UserRepository,
        private auditLogRepository?: AuditLogRepository
    ) { }

    async getAuthorizationRules(userId: string) {
        return this.authorizationRepository.findByUserId(userId);
    }

    async createAuthorizationRule(
        userId: string,
        geographicAreaId: string,
        ruleType: AuthorizationRuleType,
        createdBy: string
    ) {
        // Validate user exists
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('NOT_FOUND', 'User not found', 404);
        }

        // Validate geographic area exists
        const area = await this.geographicAreaRepository.findById(geographicAreaId);
        if (!area) {
            throw new AppError('NOT_FOUND', 'Geographic area not found', 404);
        }

        // Check for duplicate
        const existing = await this.authorizationRepository.findByUserAndArea(
            userId,
            geographicAreaId
        );
        if (existing) {
            throw new AppError(
                'DUPLICATE_AUTHORIZATION_RULE',
                'Authorization rule already exists for this user and geographic area',
                400
            );
        }

        return this.authorizationRepository.create({
            userId,
            geographicAreaId,
            ruleType,
            createdBy,
        });
    }

    async deleteAuthorizationRule(authId: string) {
        return this.authorizationRepository.delete(authId);
    }

    async hasGeographicRestrictions(userId: string): Promise<boolean> {
        const rules = await this.authorizationRepository.findByUserId(userId);
        return rules.length > 0;
    }

    async evaluateAccess(
        userId: string,
        geographicAreaId: string
    ): Promise<AccessLevel> {
        const rules = await this.authorizationRepository.findByUserId(userId);

        // No rules = unrestricted access
        if (rules.length === 0) {
            return AccessLevel.FULL;
        }

        // Get ancestors of the target area
        const ancestors = await this.geographicAreaRepository.findAncestors(
            geographicAreaId
        );
        const ancestorIds = ancestors.map((a) => a.id);

        // Check for DENY rules first (including ancestors)
        const denyRules = rules.filter((r) => r.ruleType === 'DENY');
        for (const rule of denyRules) {
            if (
                rule.geographicAreaId === geographicAreaId ||
                ancestorIds.includes(rule.geographicAreaId)
            ) {
                return AccessLevel.NONE;
            }
        }

        // Check for ALLOW rules
        const allowRules = rules.filter((r) => r.ruleType === 'ALLOW');
        let highestAccessLevel = AccessLevel.NONE;

        for (const rule of allowRules) {
            // Full access to allowed area and descendants
            if (rule.geographicAreaId === geographicAreaId) {
                return AccessLevel.FULL; // Immediate return for exact match
            }

            const descendants = await this.geographicAreaRepository.findDescendants(
                rule.geographicAreaId
            );
            if (descendants.includes(geographicAreaId)) {
                return AccessLevel.FULL; // Immediate return for descendant
            }

            // Read-only access to ancestors (but don't return yet, might find FULL later)
            const ruleAncestors = await this.geographicAreaRepository.findAncestors(
                rule.geographicAreaId
            );
            const ruleAncestorIds = ruleAncestors.map((a) => a.id);
            if (ruleAncestorIds.includes(geographicAreaId)) {
                highestAccessLevel = AccessLevel.READ_ONLY;
            }
        }

        return highestAccessLevel;
    }

    async getAuthorizationInfo(userId: string): Promise<AuthorizationInfo> {
        const rules = await this.authorizationRepository.findByUserId(userId);

        if (rules.length === 0) {
            return {
                hasGeographicRestrictions: false,
                authorizedAreaIds: [],
                readOnlyAreaIds: [],
            };
        }

        const authorizedAreaIds = new Set<string>();
        const readOnlyAreaIds = new Set<string>();

        // Process ALLOW rules
        const allowRules = rules.filter((r) => r.ruleType === 'ALLOW');
        for (const rule of allowRules) {
            // Add the allowed area
            authorizedAreaIds.add(rule.geographicAreaId);

            // Add all descendants
            const descendants = await this.geographicAreaRepository.findDescendants(
                rule.geographicAreaId
            );
            descendants.forEach((id) => authorizedAreaIds.add(id));

            // Add ancestors as read-only
            const ancestors = await this.geographicAreaRepository.findAncestors(
                rule.geographicAreaId
            );
            ancestors.forEach((ancestor) => readOnlyAreaIds.add(ancestor.id));
        }

        // Remove any areas that have DENY rules
        const denyRules = rules.filter((r) => r.ruleType === 'DENY');
        for (const rule of denyRules) {
            authorizedAreaIds.delete(rule.geographicAreaId);
            readOnlyAreaIds.delete(rule.geographicAreaId);

            // Remove descendants of denied areas
            const descendants = await this.geographicAreaRepository.findDescendants(
                rule.geographicAreaId
            );
            descendants.forEach((id) => {
                authorizedAreaIds.delete(id);
                readOnlyAreaIds.delete(id);
            });
        }

        return {
            hasGeographicRestrictions: true,
            authorizedAreaIds: Array.from(authorizedAreaIds),
            readOnlyAreaIds: Array.from(readOnlyAreaIds),
        };
    }

    async getAuthorizedAreas(userId: string): Promise<AuthorizedArea[]> {
        const rules = await this.authorizationRepository.findByUserId(userId);

        if (rules.length === 0) {
            // No restrictions - return all areas with FULL access
            const allAreas = await this.geographicAreaRepository.findAll();
            return allAreas.map((area) => ({
                geographicAreaId: area.id,
                geographicAreaName: area.name,
                areaType: area.areaType,
                accessLevel: AccessLevel.FULL,
            }));
        }

        const authorizedAreas = new Map<string, AuthorizedArea>();
        const ancestorAreaIds = new Set<string>(); // Track which areas are ancestors

        // Process ALLOW rules
        const allowRules = rules.filter((r) => r.ruleType === 'ALLOW');
        for (const rule of allowRules) {
            const area = await this.geographicAreaRepository.findById(
                rule.geographicAreaId
            );
            if (!area) continue;

            // Add the allowed area with FULL access
            authorizedAreas.set(area.id, {
                geographicAreaId: area.id,
                geographicAreaName: area.name,
                areaType: area.areaType,
                accessLevel: AccessLevel.FULL,
            });

            // Add descendants with FULL access
            const descendants = await this.geographicAreaRepository.findDescendants(
                rule.geographicAreaId
            );
            for (const descendantId of descendants) {
                const descendantArea = await this.geographicAreaRepository.findById(
                    descendantId
                );
                if (descendantArea) {
                    authorizedAreas.set(descendantArea.id, {
                        geographicAreaId: descendantArea.id,
                        geographicAreaName: descendantArea.name,
                        areaType: descendantArea.areaType,
                        accessLevel: AccessLevel.FULL,
                        isDescendant: true,
                    });
                }
            }

            // Track ancestors for later marking
            const ancestors = await this.geographicAreaRepository.findAncestors(
                rule.geographicAreaId
            );
            for (const ancestor of ancestors) {
                ancestorAreaIds.add(ancestor.id);

                // Only add if not already present with FULL access
                if (!authorizedAreas.has(ancestor.id)) {
                    authorizedAreas.set(ancestor.id, {
                        geographicAreaId: ancestor.id,
                        geographicAreaName: ancestor.name,
                        areaType: ancestor.areaType,
                        accessLevel: AccessLevel.READ_ONLY,
                        isAncestor: true,
                    });
                }
            }
        }

        // Mark all ancestor areas with isAncestor=true, even if they have FULL access
        // This ensures the frontend can distinguish areas that provide navigation context
        // from areas that are directly allowed for filtering purposes
        for (const ancestorId of ancestorAreaIds) {
            const existingArea = authorizedAreas.get(ancestorId);
            if (existingArea) {
                authorizedAreas.set(ancestorId, {
                    ...existingArea,
                    isAncestor: true,
                });
            }
        }

        // Process DENY rules - remove denied areas and their descendants
        const denyRules = rules.filter((r) => r.ruleType === 'DENY');
        for (const rule of denyRules) {
            const area = await this.geographicAreaRepository.findById(
                rule.geographicAreaId
            );
            if (!area) continue;

            // Mark denied area
            authorizedAreas.set(area.id, {
                geographicAreaId: area.id,
                geographicAreaName: area.name,
                areaType: area.areaType,
                accessLevel: AccessLevel.NONE,
            });

            // Mark descendants as denied
            const descendants = await this.geographicAreaRepository.findDescendants(
                rule.geographicAreaId
            );
            for (const descendantId of descendants) {
                const descendantArea = await this.geographicAreaRepository.findById(
                    descendantId
                );
                if (descendantArea) {
                    authorizedAreas.set(descendantArea.id, {
                        geographicAreaId: descendantArea.id,
                        geographicAreaName: descendantArea.name,
                        areaType: descendantArea.areaType,
                        accessLevel: AccessLevel.NONE,
                    });
                }
            }
        }

        return Array.from(authorizedAreas.values());
    }

    async validateCreateGeographicArea(
        userId: string,
        parentGeographicAreaId: string | null
    ): Promise<void> {
        const authInfo = await this.getAuthorizationInfo(userId);

        // If user has geographic restrictions
        if (authInfo.hasGeographicRestrictions) {
            // Prevent creating top-level areas
            if (!parentGeographicAreaId) {
                throw new AppError(
                    'CANNOT_CREATE_TOP_LEVEL_AREA',
                    'Users with geographic restrictions cannot create top-level geographic areas',
                    403
                );
            }

            // Validate parent is in authorized areas
            const accessLevel = await this.evaluateAccess(userId, parentGeographicAreaId);
            if (accessLevel !== AccessLevel.FULL) {
                throw new AppError(
                    'GEOGRAPHIC_AUTHORIZATION_DENIED',
                    'You do not have permission to create geographic areas under this parent area',
                    403
                );
            }
        }
    }

    async validateGeographicAreaAccess(
        userId: string,
        geographicAreaId: string,
        requiredAccessLevel: AccessLevel = AccessLevel.FULL
    ): Promise<void> {
        const accessLevel = await this.evaluateAccess(userId, geographicAreaId);

        if (requiredAccessLevel === AccessLevel.FULL && accessLevel !== AccessLevel.FULL) {
            throw new AppError(
                'GEOGRAPHIC_AUTHORIZATION_DENIED',
                'You do not have permission to access this geographic area',
                403
            );
        }

        if (requiredAccessLevel === AccessLevel.READ_ONLY && accessLevel === AccessLevel.NONE) {
            throw new AppError(
                'GEOGRAPHIC_AUTHORIZATION_DENIED',
                'You do not have permission to access this geographic area',
                403
            );
        }
    }

    /**
     * Logs an authorization denial to the audit log
     */
    async logAuthorizationDenial(
        userId: string,
        resourceType: string,
        resourceId: string,
        action: string
    ): Promise<void> {
        if (this.auditLogRepository) {
            await this.auditLogRepository.create({
                userId,
                actionType: 'AUTHORIZATION_DENIED',
                entityType: resourceType,
                entityId: resourceId,
                details: {
                    action,
                    reason: 'GEOGRAPHIC_AUTHORIZATION_DENIED',
                },
            });
        }
    }
}
