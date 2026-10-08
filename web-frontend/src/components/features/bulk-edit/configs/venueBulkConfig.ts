import type { Venue } from '../../../../types';
import { GeographicAreaService } from '../../../../services/api/geographic-area.service';
import type { BulkEntityConfig } from '../BulkEntityConfig';
import { validateRequiredFields } from '../BulkEntityConfig';

/**
 * Bulk-edit config for Venues (spec section 2.7).
 */
export const venueBulkConfig: BulkEntityConfig<Venue> = {
    entityName: 'Venues',
    entityPath: 'venues',
    columns: [
        {
            field: 'name',
            header: 'Name',
            type: 'text',
            required: true,
            minWidth: 200,
            validate: (v) =>
                typeof v === 'string' && v.length > 200
                    ? 'Name must be at most 200 characters'
                    : null,
        },
        {
            field: 'address',
            header: 'Address',
            type: 'text',
            required: true,
            minWidth: 240,
            validate: (v) =>
                typeof v === 'string' && v.length > 500
                    ? 'Address must be at most 500 characters'
                    : null,
        },
        {
            field: 'geographicAreaId',
            header: 'Geographic Area',
            type: 'reference',
            required: true,
            minWidth: 220,
            reference: {
                entityType: 'geographic-area',
                fetchFunction: async (params) => {
                    const res = await GeographicAreaService.getGeographicAreasFlexible({
                        page: params.page,
                        limit: params.limit,
                        filter: params.filter as Record<string, unknown> | undefined,
                        fields: params.fields,
                    });
                    return res as { data: unknown[]; pagination?: unknown };
                },
                fetchByIdFunction: (id) => GeographicAreaService.getGeographicAreaById(id),
                formatOption: (entity) => {
                    const area = entity as { id: string; name: string };
                    return { value: area.id, label: area.name };
                },
                renderLabel: (row) => {
                    const area = (row as { geographicArea?: { name: string } }).geographicArea;
                    const id = (row as { geographicAreaId?: string }).geographicAreaId;
                    return area?.name ?? id ?? '-';
                },
            },
        },
        {
            field: 'latitude',
            header: 'Latitude',
            type: 'number',
            minWidth: 120,
            validate: (v) =>
                typeof v === 'number' && (v < -90 || v > 90)
                    ? 'Latitude must be between -90 and 90'
                    : null,
        },
        {
            field: 'longitude',
            header: 'Longitude',
            type: 'number',
            minWidth: 120,
            validate: (v) =>
                typeof v === 'number' && (v < -180 || v > 180)
                    ? 'Longitude must be between -180 and 180'
                    : null,
        },
        {
            field: 'venueType',
            header: 'Venue Type',
            type: 'enum',
            minWidth: 180,
            choices: [
                { value: 'PUBLIC_BUILDING', label: 'Public Building' },
                { value: 'PRIVATE_RESIDENCE', label: 'Private Residence' },
            ],
        },
    ],
    emptyRow: () => ({
        name: '',
        address: '',
        geographicAreaId: '',
    }),
    clientValidate: (row) => validateRequiredFields(venueBulkConfig.columns, row),
};

// Import helper so `venueBulkConfig.columns` can be referenced in clientValidate
// without a circular dependency (handled by the config object being fully
// evaluated before the function is ever called).
