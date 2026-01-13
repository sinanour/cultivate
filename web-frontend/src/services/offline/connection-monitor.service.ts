import { SyncQueue } from './sync-queue.service';

type ConnectionListener = (isOnline: boolean) => void;

export class ConnectionMonitor {
    private static listeners: ConnectionListener[] = [];
    private static isInitialized = false;

    static initialize(): void {
        if (this.isInitialized) return;

        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);

        this.isInitialized = true;
    }

    static cleanup(): void {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        this.listeners = [];
        this.isInitialized = false;
    }

    static isOnline(): boolean {
        return navigator.onLine;
    }

    static subscribe(listener: ConnectionListener): () => void {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private static handleOnline = async () => {

        // Notify all listeners
        this.listeners.forEach((listener) => listener(true));

        // Process sync queue
        try {
            const result = await SyncQueue.processQueue();
        } catch (error) {
            console.error('Failed to process sync queue:', error);
        }
    };

    private static handleOffline = () => {

        // Notify all listeners
        this.listeners.forEach((listener) => listener(false));
    };
}
