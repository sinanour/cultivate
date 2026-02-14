/**
 * Utility functions for transforming participant data
 */

import { calculateAgeCohort } from './age-cohort.utils';

export interface PopulationData {
    id: string;
    name: string;
}

export interface ParticipantWithPopulations {
    dateOfBirth?: Date | null;
    participantPopulations?: Array<{
        population: PopulationData;
    }>;
    [key: string]: any;
}

/**
 * Transforms a single participant response to include flattened populations array and ageCohort
 * Converts participantPopulations relation to a simple populations array
 * Calculates ageCohort from dateOfBirth
 */
export function transformParticipantResponse(
    participant: ParticipantWithPopulations,
    referenceDate?: Date
): any {
    if (!participant) {
        return participant;
    }

    const { participantPopulations, ...rest } = participant;

    return {
        ...rest,
        populations: participantPopulations?.map(pp => pp.population) || [],
        ageCohort: calculateAgeCohort(participant.dateOfBirth, referenceDate)
    };
}

/**
 * Transforms an array of participant responses to include flattened populations arrays and ageCohort
 */
export function transformParticipantResponses(
    participants: ParticipantWithPopulations[],
    referenceDate?: Date
): any[] {
    return participants.map(p => transformParticipantResponse(p, referenceDate));
}
