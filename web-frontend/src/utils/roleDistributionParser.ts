import type { RoleDistributionWireFormat } from '../services/api/analytics.service';

export interface ParsedRoleDistribution {
    roleId: string;
    roleName: string;
    count: number;
}

/**
 * Parse role distribution wire format into human-readable objects
 */
export function parseRoleDistributionWireFormat(
    wireFormat: RoleDistributionWireFormat
): ParsedRoleDistribution[] {
    const { data, lookups } = wireFormat;
    const { roles } = lookups;

    return data.map(row => {
        const [roleIndex, count] = row;
        const role = roles[roleIndex];

        return {
            roleId: role.id,
            roleName: role.name,
            count,
        };
    });
}
