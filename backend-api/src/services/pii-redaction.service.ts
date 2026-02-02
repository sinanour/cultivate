import { UserRole } from '@prisma/client';

/**
 * Service for redacting personally identifiable information (PII) from API responses
 * based on user role. Implements defense-in-depth by applying redaction at the
 * response serialization layer.
 */
export class PIIRedactionService {
    /**
     * Redact participant PII fields for PII_RESTRICTED users
     * Home address associations are considered PII and must be completely hidden
     * @param participant - The participant object to potentially redact
     * @param role - The user's role
     * @returns Participant with PII fields redacted if role is PII_RESTRICTED
     */
    redactParticipant(participant: any, role: UserRole): any {
        if (role !== UserRole.PII_RESTRICTED) {
            return participant;
        }

        return {
            ...participant,
            id: participant.id, // UUID preserved
            name: null,
            email: null,
            phone: null,
            notes: null,
            dateOfBirth: null,
            dateOfRegistration: null,
            nickname: null,
            // Address history is PII - return empty array
            addressHistory: [],
        };
    }

    /**
     * Redact venue PII fields for PII_RESTRICTED users
     * Participant associations are considered PII and must be completely hidden
     * @param venue - The venue object to potentially redact
     * @param role - The user's role
     * @returns Venue with name redacted and participant associations hidden if role is PII_RESTRICTED
     */
    redactVenue(venue: any, role: UserRole): any {
        if (role !== UserRole.PII_RESTRICTED) {
            return venue;
        }

        return {
            ...venue,
            name: null, // Name redacted
            // Hide participant associations (participants field)
            participants: venue.participants ? [] : venue.participants,
            // Address, coordinates, and other non-PII fields preserved
        };
    }

    /**
     * Recursively redact PII from response data
     * @param data - The response data to redact
     * @param role - The user's role
     * @returns Data with PII redacted if role is PII_RESTRICTED
     */
    redactResponse(data: any, role: UserRole): any {
        if (role !== UserRole.PII_RESTRICTED) {
            return data;
        }

        // Handle null/undefined
        if (data === null || data === undefined) {
            return data;
        }

        // Handle arrays
        if (Array.isArray(data)) {
            return data.map((item) => this.redactResponse(item, role));
        }

        // Handle objects
        if (typeof data === 'object') {
            // Check if this is a participant object (has participant-specific fields)
            if (this.isParticipant(data)) {
                return this.redactParticipant(data, role);
            }

            // Check if this is a venue object (has venue-specific fields)
            if (this.isVenue(data)) {
                return this.redactVenue(data, role);
            }

            // Recursively process nested objects
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = this.redactResponse(value, role);
            }
            return result;
        }

        // Primitive values pass through
        return data;
    }

    /**
     * Type guard to check if an object is a Participant
     * Participants have email, phone, dateOfBirth, or nickname fields
     */
    private isParticipant(obj: any): boolean {
        return (
            obj &&
            typeof obj === 'object' &&
            'id' in obj &&
            // Must have at least one participant-specific field
            ('email' in obj || 'phone' in obj || 'dateOfBirth' in obj || 'nickname' in obj || 'dateOfRegistration' in obj) &&
            // Must NOT have venue-specific fields
            !('address' in obj && 'geographicAreaId' in obj)
        );
    }

    /**
     * Type guard to check if an object is a Venue
     * Venues have address and geographicAreaId fields
     */
    private isVenue(obj: any): boolean {
        return (
            obj &&
            typeof obj === 'object' &&
            'id' in obj &&
            'address' in obj &&
            'geographicAreaId' in obj &&
            // Must NOT have participant-specific fields
            !('email' in obj || 'phone' in obj || 'dateOfBirth' in obj || 'nickname' in obj || 'dateOfRegistration' in obj)
        );
    }
}
