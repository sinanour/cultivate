import { useAuth } from './useAuth';
import { UserRole } from '../types';

export function usePermissions() {
    const { user } = useAuth();

    const hasRole = (role: UserRole): boolean => {
        return user?.role === role;
    };

    const canCreate = (): boolean => {
        return user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';
    };

    const canEdit = (): boolean => {
        return user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';
    };

    const canDelete = (): boolean => {
        return user?.role === 'ADMINISTRATOR' || user?.role === 'EDITOR';
    };

    const isReadOnly = (): boolean => {
        return user?.role === 'READ_ONLY';
    };

    const isAdministrator = (): boolean => {
        return user?.role === 'ADMINISTRATOR';
    };

    return {
        hasRole,
        canCreate,
        canEdit,
        canDelete,
        isReadOnly,
        isAdministrator,
    };
}
