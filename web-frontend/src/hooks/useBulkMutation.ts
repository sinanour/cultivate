import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
    BulkMutationRequest,
    BulkMutationResponse,
    BulkMutationSuccessResponse,
    BulkMutationFailureResponse,
} from '../services/api/bulk.service';
import { BulkService } from '../services/api/bulk.service';

export type BulkEntityPath = 'venues' | 'participants' | 'activities';

export interface UseBulkMutationArgs<TCreate, TUpdate> {
    entityPath: BulkEntityPath;
    /**
     * React Query cache key prefix for the paginated list the toolbar should
     * invalidate on success. Typically matches the key used by the list
     * endpoint (e.g. "venues" for the Venues list).
     */
    listQueryKeyPrefix: string;
    onSuccess?: (result: BulkMutationSuccessResponse<unknown>) => void;
    onFailure?: (failure: BulkMutationFailureResponse) => void;
    // Allow callers to override the service for unit tests.
    submitFn?: (
        entityPath: BulkEntityPath,
        request: BulkMutationRequest<TCreate, TUpdate>
    ) => Promise<BulkMutationResponse<unknown>>;
}

/**
 * useBulkMutation - thin wrapper around React Query's `useMutation` that
 * serialises a staged change set into a POST /{entity}/bulk and routes the
 * response (success envelope OR thrown failure envelope) to typed callbacks.
 *
 * On success the hook invalidates the entity's list query so the table re-reads
 * the authoritative server state. On failure the staged set is kept intact so
 * the user can reconcile and retry (requirements 8.4, 8.5, 11.3).
 */
export function useBulkMutation<TCreate, TUpdate>({
    entityPath,
    listQueryKeyPrefix,
    onSuccess,
    onFailure,
    submitFn,
}: UseBulkMutationArgs<TCreate, TUpdate>) {
    const queryClient = useQueryClient();
    const submitter = submitFn ?? BulkService.submit.bind(BulkService);

    const mutation = useMutation({
        mutationFn: async (request: BulkMutationRequest<TCreate, TUpdate>) => {
            try {
                const response = (await submitter(entityPath, request)) as BulkMutationResponse<unknown>;
                return response;
            } catch (err) {
                // ApiClient throws on non-2xx; the response body is on err.response.data.
                const anyErr = err as { response?: { data?: unknown }; message?: string };
                const body = anyErr?.response?.data;
                if (body && typeof body === 'object' && 'success' in body) {
                    return body as BulkMutationFailureResponse;
                }
                throw err;
            }
        },
        onSuccess: (response) => {
            if (response.success) {
                void queryClient.invalidateQueries({ queryKey: [listQueryKeyPrefix] });
                onSuccess?.(response);
            } else {
                onFailure?.(response);
            }
        },
    });

    return mutation;
}
