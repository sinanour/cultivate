/**
 * Utility functions for transforming participant data
 */

export interface PopulationData {
    id: string;
    name: string;
}

export interface ParticipantWithPopulations {
    participantPopulations?: Array<{
        population: PopulationData;
    }>;
    [key: string]: any;
}

/**
 * Transforms a single participant response to include flattened populations array
 * Converts participantPopulations relation to a simple populations array
 */
export function transformParticipantResponse(participant: ParticipantWithPopulations): any {
    if (!participant) {
        return participant;
    }

    const { participantPopulations, ...rest } = participant;

    return {
        ...rest,
        populations: participantPopulations?.map(pp => pp.population) || []
    };
}

/**
 * Transforms an array of participant responses to include flattened populations arrays
 */
export function transformParticipantResponses(participants: ParticipantWithPopulations[]): any[] {
    return participants.map(transformParticipantResponse);
}
