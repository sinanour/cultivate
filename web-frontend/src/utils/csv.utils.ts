/**
 * Trigger browser download of a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Validate CSV file before upload
 */
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
    if (!file.name.endsWith('.csv')) {
        return { valid: false, error: 'File must be a CSV (.csv extension)' };
    }

    if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: 'File size must be less than 10MB' };
    }

    return { valid: true };
}
