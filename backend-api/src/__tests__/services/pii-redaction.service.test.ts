import { PIIRedactionService } from '../../services/pii-redaction.service';
import { UserRole } from '@prisma/client';

describe('PIIRedactionService', () => {
    let service: PIIRedactionService;

    beforeEach(() => {
        service = new PIIRedactionService();
    });

    describe('redactParticipant', () => {
        const mockParticipant = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            notes: 'Some notes',
            dateOfBirth: new Date('1990-01-01'),
            dateOfRegistration: new Date('2020-01-01'),
            nickname: 'Johnny',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should not redact participant for ADMINISTRATOR role', () => {
            const result = service.redactParticipant(mockParticipant, UserRole.ADMINISTRATOR);
            expect(result).toEqual(mockParticipant);
        });

        it('should not redact participant for EDITOR role', () => {
            const result = service.redactParticipant(mockParticipant, UserRole.EDITOR);
            expect(result).toEqual(mockParticipant);
        });

        it('should not redact participant for READ_ONLY role', () => {
            const result = service.redactParticipant(mockParticipant, UserRole.READ_ONLY);
            expect(result).toEqual(mockParticipant);
        });

        it('should redact all PII fields for PII_RESTRICTED role', () => {
            const result = service.redactParticipant(mockParticipant, UserRole.PII_RESTRICTED);

            expect(result.id).toBe(mockParticipant.id); // UUID preserved
            expect(result.name).toBeNull();
            expect(result.email).toBeNull();
            expect(result.phone).toBeNull();
            expect(result.notes).toBeNull();
            expect(result.dateOfBirth).toBeNull();
            expect(result.dateOfRegistration).toBeNull();
            expect(result.nickname).toBeNull();
        });

        it('should preserve non-PII fields for PII_RESTRICTED role', () => {
            const result = service.redactParticipant(mockParticipant, UserRole.PII_RESTRICTED);

            expect(result.createdAt).toEqual(mockParticipant.createdAt);
            expect(result.updatedAt).toEqual(mockParticipant.updatedAt);
        });

        it('should return empty address history for PII_RESTRICTED role', () => {
            const participantWithHistory = {
                ...mockParticipant,
                addressHistory: [
                    {
                        id: 'history-1',
                        participantId: mockParticipant.id,
                        venueId: 'venue-1',
                        effectiveFrom: new Date('2020-01-01'),
                        venue: {
                            id: 'venue-1',
                            name: 'Community Center',
                            address: '123 Main St',
                            geographicAreaId: 'area-1',
                            latitude: 40.7128,
                            longitude: -74.0060,
                        },
                    },
                ],
            };

            const result = service.redactParticipant(participantWithHistory, UserRole.PII_RESTRICTED);

            // Address history should be empty array (PII)
            expect(result.addressHistory).toEqual([]);
        });
    });

    describe('redactVenue', () => {
        const mockVenue = {
            id: 'venue-123',
            name: 'Community Center',
            address: '123 Main St',
            geographicAreaId: 'area-1',
            latitude: 40.7128,
            longitude: -74.0060,
            venueType: 'PUBLIC_BUILDING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should not redact venue for non-PII_RESTRICTED roles', () => {
            expect(service.redactVenue(mockVenue, UserRole.ADMINISTRATOR)).toEqual(mockVenue);
            expect(service.redactVenue(mockVenue, UserRole.EDITOR)).toEqual(mockVenue);
            expect(service.redactVenue(mockVenue, UserRole.READ_ONLY)).toEqual(mockVenue);
        });

        it('should redact venue name for PII_RESTRICTED role', () => {
            const result = service.redactVenue(mockVenue, UserRole.PII_RESTRICTED);

            expect(result.name).toBeNull();
        });

        it('should preserve non-PII venue fields for PII_RESTRICTED role', () => {
            const result = service.redactVenue(mockVenue, UserRole.PII_RESTRICTED);

            expect(result.id).toBe(mockVenue.id);
            expect(result.address).toBe(mockVenue.address);
            expect(result.latitude).toBe(mockVenue.latitude);
            expect(result.longitude).toBe(mockVenue.longitude);
            expect(result.geographicAreaId).toBe(mockVenue.geographicAreaId);
            expect(result.venueType).toBe(mockVenue.venueType);
        });

        it('should hide participant associations for PII_RESTRICTED role', () => {
            const venueWithParticipants = {
                ...mockVenue,
                participants: [
                    { id: 'p1', name: 'John Doe' },
                    { id: 'p2', name: 'Jane Smith' },
                ],
            };

            const result = service.redactVenue(venueWithParticipants, UserRole.PII_RESTRICTED);

            // Participant associations should be empty array (PII)
            expect(result.participants).toEqual([]);
        });
    });

    describe('redactResponse', () => {
        it('should handle null and undefined', () => {
            expect(service.redactResponse(null, UserRole.PII_RESTRICTED)).toBeNull();
            expect(service.redactResponse(undefined, UserRole.PII_RESTRICTED)).toBeUndefined();
        });

        it('should handle primitive values', () => {
            expect(service.redactResponse('string', UserRole.PII_RESTRICTED)).toBe('string');
            expect(service.redactResponse(123, UserRole.PII_RESTRICTED)).toBe(123);
            expect(service.redactResponse(true, UserRole.PII_RESTRICTED)).toBe(true);
        });

        it('should handle arrays of participants', () => {
            const participants = [
                { id: '1', name: 'John', email: 'john@example.com' },
                { id: '2', name: 'Jane', email: 'jane@example.com' },
            ];

            const result = service.redactResponse(participants, UserRole.PII_RESTRICTED);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBeNull();
            expect(result[1].name).toBeNull();
            expect(result[0].id).toBe('1');
            expect(result[1].id).toBe('2');
        });

        it('should handle nested objects with participants and venues', () => {
            const data = {
                success: true,
                data: {
                    participant: {
                        id: '1',
                        name: 'John',
                        email: 'john@example.com',
                    },
                    venue: {
                        id: 'venue-1',
                        name: 'Community Center',
                        address: '123 Main St',
                        geographicAreaId: 'area-1',
                    },
                },
            };

            const result = service.redactResponse(data, UserRole.PII_RESTRICTED);

            expect(result.success).toBe(true);
            expect(result.data.participant.name).toBeNull();
            expect(result.data.participant.id).toBe('1');
            expect(result.data.venue.name).toBeNull();
            expect(result.data.venue.address).toBe('123 Main St');
        });

        it('should not redact non-PII resources', () => {
            const data = {
                success: true,
                data: {
                    activityType: {
                        id: 'type-1',
                        name: 'Study Circle',
                        activityCategoryId: 'cat-1',
                    },
                    geographicArea: {
                        id: 'area-1',
                        name: 'Downtown',
                        areaType: 'NEIGHBOURHOOD',
                    },
                },
            };

            const result = service.redactResponse(data, UserRole.PII_RESTRICTED);

            // Non-PII resources should not be redacted
            expect(result.data.activityType.name).toBe('Study Circle');
            expect(result.data.geographicArea.name).toBe('Downtown');
        });
    });
});
