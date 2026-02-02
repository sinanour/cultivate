import { render, screen } from '@testing-library/react';
import { ParticipantDisplay } from '../ParticipantDisplay';
import { describe, it, expect } from 'vitest';

describe('ParticipantDisplay', () => {
    const mockParticipant = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
    };

    it('should display participant name for ADMINISTRATOR role', () => {
        render(
            <ParticipantDisplay
                participant={mockParticipant}
                currentUserRole="ADMINISTRATOR"
            />
        );
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display participant name for EDITOR role', () => {
        render(
            <ParticipantDisplay
                participant={mockParticipant}
                currentUserRole="EDITOR"
            />
        );
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display participant name for READ_ONLY role', () => {
        render(
            <ParticipantDisplay
                participant={mockParticipant}
                currentUserRole="READ_ONLY"
            />
        );
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display UUID for PII_RESTRICTED role', () => {
        render(
            <ParticipantDisplay
                participant={mockParticipant}
                currentUserRole="PII_RESTRICTED"
            />
        );
        expect(screen.getByText('123e4567-e89b-12d3-a456-426614174000')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should display UUID as fallback when name is null', () => {
        const participantWithoutName = {
            ...mockParticipant,
            name: null,
        };

        render(
            <ParticipantDisplay
                participant={participantWithoutName}
                currentUserRole="ADMINISTRATOR"
            />
        );
        expect(screen.getByText('123e4567-e89b-12d3-a456-426614174000')).toBeInTheDocument();
    });

    it('should handle null participant gracefully', () => {
        const { container } = render(
            <ParticipantDisplay
                participant={null as any}
                currentUserRole="ADMINISTRATOR"
            />
        );
        expect(container.textContent).toBe('');
    });
});
