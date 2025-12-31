export interface ImportResult {
    totalRows: number;
    successCount: number;
    failureCount: number;
    errors: ImportError[];
}

export interface ImportError {
    row: number;
    data: Record<string, any>;
    errors: string[];
}
