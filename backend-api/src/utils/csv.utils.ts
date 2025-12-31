import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';

export interface CSVExportOptions {
    columns: string[];
    data: any[];
}

export interface CSVImportResult<T> {
    records: T[];
    errors: Array<{
        row: number;
        data: any;
        message: string;
    }>;
}

/**
 * Generate CSV string from data
 */
export function generateCSV(options: CSVExportOptions): string {
    const { columns, data } = options;

    if (data.length === 0) {
        // Return empty CSV with header row only
        return stringify([columns], { header: false });
    }

    return stringify(data, {
        header: true,
        columns: columns,
        quoted: true,
        delimiter: ',',
        record_delimiter: '\n'
    });
}

/**
 * Parse CSV string or buffer into records
 */
export function parseCSV<T = any>(input: string | Buffer): T[] {
    try {
        const records = parse(input, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: [',', ';'],
            relax_column_count: true,
            cast: false // Don't auto-cast, let Zod handle validation
        }) as T[];

        return records;
    } catch (error) {
        throw new Error(`Invalid CSV format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Format date for CSV export (YYYY-MM-DD)
 */
export function formatDateForCSV(date: Date | string | null | undefined): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString().split('T')[0];
}

/**
 * Generate filename with current date
 */
export function generateCSVFilename(entityType: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `${entityType}-${date}.csv`;
}
