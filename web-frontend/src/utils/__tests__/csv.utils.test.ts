import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob, validateCSVFile, generateEngagementSummaryCSV } from '../csv.utils';

describe('CSV Utilities', () => {
    describe('downloadBlob', () => {
        beforeEach(() => {
            // Mock DOM methods
            global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            global.URL.revokeObjectURL = vi.fn();
            document.body.appendChild = vi.fn();
            document.body.removeChild = vi.fn();
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should trigger download with correct filename', () => {
            const blob = new Blob(['test'], { type: 'text/csv' });
            const filename = 'test.csv';

            downloadBlob(blob, filename);

            expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();
            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });
    });

    describe('validateCSVFile', () => {
        it('should accept valid CSV file', () => {
            const file = new File(['test'], 'test.csv', { type: 'text/csv' });
            const result = validateCSVFile(file);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject non-CSV file', () => {
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });
            const result = validateCSVFile(file);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('File must be a CSV (.csv extension)');
        });

        it('should reject file larger than 10MB', () => {
            const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
            const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
            const result = validateCSVFile(file);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('File size must be less than 10MB');
        });
    });

    describe('generateEngagementSummaryCSV', () => {
        // Helper to read blob content
        const readBlobAsText = async (blob: Blob): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(blob);
            });
        };

        it('should generate CSV with Total row only when no grouping', async () => {
            const metrics = {
                activitiesAtStart: 10,
                activitiesAtEnd: 15,
                activitiesStarted: 8,
                activitiesCompleted: 3,
                activitiesCancelled: 0,
                participantsAtStart: 50,
                participantsAtEnd: 55,
                groupedResults: [],
                groupingDimensions: [],
            };

            const blob = generateEngagementSummaryCSV(metrics, []);
            expect(blob.type).toBe('text/csv;charset=utf-8;');

            const text = await readBlobAsText(blob);
            const lines = text.split('\n');
            expect(lines.length).toBe(2); // Header + Total row
            expect(lines[0]).toContain('Activities at Start');
            expect(lines[1]).toContain('Total');
            expect(lines[1]).toContain('10'); // activitiesAtStart
            expect(lines[1]).toContain('55'); // participantsAtEnd
        });

        it('should generate CSV with dimensional breakdowns when grouping is active', async () => {
            const metrics = {
                activitiesAtStart: 20,
                activitiesAtEnd: 25,
                activitiesStarted: 10,
                activitiesCompleted: 5,
                activitiesCancelled: 0,
                participantsAtStart: 100,
                participantsAtEnd: 110,
                groupedResults: [
                    {
                        dimensions: {
                            activityCategory: 'Study Circles',
                        },
                        metrics: {
                            activitiesAtStart: 10,
                            activitiesAtEnd: 12,
                            activitiesStarted: 5,
                            activitiesCompleted: 3,
                            activitiesCancelled: 0,
                            participantsAtStart: 50,
                            participantsAtEnd: 55,
                        },
                    },
                    {
                        dimensions: {
                            activityCategory: 'Children\'s Classes',
                        },
                        metrics: {
                            activitiesAtStart: 10,
                            activitiesAtEnd: 13,
                            activitiesStarted: 5,
                            activitiesCompleted: 2,
                            activitiesCancelled: 0,
                            participantsAtStart: 50,
                            participantsAtEnd: 55,
                        },
                    },
                ],
                groupingDimensions: ['activityCategory'],
            };

            const blob = generateEngagementSummaryCSV(metrics, ['activityCategory']);
            expect(blob.type).toBe('text/csv;charset=utf-8;');

            const text = await readBlobAsText(blob);
            const lines = text.split('\n');
            expect(lines.length).toBe(4); // Header + Total + 2 breakdown rows
            expect(lines[0]).toContain('Activity Category');
            expect(lines[1]).toContain('Total');
            expect(lines[2]).toContain('Study Circles');
            expect(lines[3]).toContain('Children\'s Classes');
        });

        it('should use human-friendly labels not UUIDs', async () => {
            const metrics = {
                activitiesAtStart: 5,
                activitiesAtEnd: 5,
                activitiesStarted: 5,
                activitiesCompleted: 0,
                activitiesCancelled: 0,
                participantsAtStart: 25,
                participantsAtEnd: 25,
                groupedResults: [
                    {
                        dimensions: {
                            venue: 'Community Center', // Human-friendly label
                        },
                        metrics: {
                            activitiesAtStart: 5,
                            activitiesAtEnd: 5,
                            activitiesStarted: 5,
                            activitiesCompleted: 0,
                            activitiesCancelled: 0,
                            participantsAtStart: 25,
                            participantsAtEnd: 25,
                        },
                    },
                ],
                groupingDimensions: ['venue'],
            };

            const blob = generateEngagementSummaryCSV(metrics, ['venue']);

            const text = await readBlobAsText(blob);
            expect(text).toContain('Community Center');
            expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i); // No UUIDs
        });

        it('should escape CSV special characters', async () => {
            const metrics = {
                activitiesAtStart: 1,
                activitiesAtEnd: 1,
                activitiesStarted: 1,
                activitiesCompleted: 0,
                activitiesCancelled: 0,
                participantsAtStart: 10,
                participantsAtEnd: 10,
                groupedResults: [
                    {
                        dimensions: {
                            venue: 'Center, "Main" Building',
                        },
                        metrics: {
                            activitiesAtStart: 1,
                            activitiesAtEnd: 1,
                            activitiesStarted: 1,
                            activitiesCompleted: 0,
                            activitiesCancelled: 0,
                            participantsAtStart: 10,
                            participantsAtEnd: 10,
                        },
                    },
                ],
                groupingDimensions: ['venue'],
            };

            const blob = generateEngagementSummaryCSV(metrics, ['venue']);

            const text = await readBlobAsText(blob);
            // Should escape quotes and wrap in quotes due to comma
            expect(text).toContain('"Center, ""Main"" Building"');
        });

        it('should handle multiple grouping dimensions', async () => {
            const metrics = {
                activitiesAtStart: 5,
                activitiesAtEnd: 5,
                activitiesStarted: 5,
                activitiesCompleted: 0,
                activitiesCancelled: 0,
                participantsAtStart: 25,
                participantsAtEnd: 25,
                groupedResults: [
                    {
                        dimensions: {
                            activityCategory: 'Study Circles',
                            venue: 'Community Center',
                        },
                        metrics: {
                            activitiesAtStart: 5,
                            activitiesAtEnd: 5,
                            activitiesStarted: 5,
                            activitiesCompleted: 0,
                            activitiesCancelled: 0,
                            participantsAtStart: 25,
                            participantsAtEnd: 25,
                        },
                    },
                ],
                groupingDimensions: ['activityCategory', 'venue'],
            };

            const blob = generateEngagementSummaryCSV(metrics, ['activityCategory', 'venue']);

            const text = await readBlobAsText(blob);
            const lines = text.split('\n');
            // Header should have both dimension columns
            expect(lines[0]).toContain('Activity Category');
            expect(lines[0]).toContain('Venue');
            // Total row should have blank second dimension cell
            const totalCells = lines[1].split(',');
            expect(totalCells[0]).toContain('Total');
            expect(totalCells[1]).toBe(''); // Second dimension blank in Total row
            // Breakdown row should have both dimensions
            expect(lines[2]).toContain('Study Circles');
            expect(lines[2]).toContain('Community Center');
        });

        it('should handle empty groupedResults', async () => {
            const metrics = {
                activitiesAtStart: 0,
                activitiesAtEnd: 0,
                activitiesStarted: 0,
                activitiesCompleted: 0,
                activitiesCancelled: 0,
                participantsAtStart: 0,
                participantsAtEnd: 0,
                groupedResults: [],
                groupingDimensions: ['activityCategory'],
            };

            const blob = generateEngagementSummaryCSV(metrics, ['activityCategory']);

            const text = await readBlobAsText(blob);
            const lines = text.split('\n');
            expect(lines.length).toBe(2); // Header + Total row only
        });
    });
});
