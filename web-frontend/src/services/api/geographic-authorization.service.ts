import { ApiClient } from './api.client';

export interface UserGeographicAuthorization {
    id: string;
    userId: string;
    geographicAreaId: string;
    geographicArea?: {
        id: string;
        name: string;
        areaType: string;
    };
    ruleType: 'ALLOW' | 'DENY';
    createdAt: string;
    createdBy: string;
}

export interface AuthorizedArea {
    geographicAreaId: string;
    geographicAreaName: string;
    areaType: string;
    accessLevel: 'FULL' | 'READ_ONLY' | 'NONE';
    isDescendant?: boolean;
    isAncestor?: boolean;
}

export class GeographicAuthorizationService {
    private baseUrl = '/users';

    async getAuthorizationRules(userId: string): Promise<UserGeographicAuthorization[]> {
        return ApiClient.get<UserGeographicAuthorization[]>(
            `${this.baseUrl}/${userId}/geographic-authorizations`
        );
    }

    async createAuthorizationRule(
        userId: string,
        geographicAreaId: string,
        ruleType: 'ALLOW' | 'DENY'
    ): Promise<UserGeographicAuthorization> {
        return ApiClient.post<UserGeographicAuthorization>(
            `${this.baseUrl}/${userId}/geographic-authorizations`,
            {
                geographicAreaId,
                ruleType,
            }
        );
    }

    async deleteAuthorizationRule(userId: string, authId: string): Promise<void> {
        return ApiClient.delete<void>(`${this.baseUrl}/${userId}/geographic-authorizations/${authId}`);
    }

    async getAuthorizedAreas(userId: string): Promise<AuthorizedArea[]> {
        return ApiClient.get<AuthorizedArea[]>(`${this.baseUrl}/${userId}/authorized-areas`);
    }
}

export const geographicAuthorizationService = new GeographicAuthorizationService();
