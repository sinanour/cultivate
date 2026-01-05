/**
 * Event emitter for geographic filter authorization errors
 * Allows API client to trigger filter clearing without direct context access
 */

type GeographicAuthErrorListener = () => void;

class GeographicFilterEventEmitter {
    private listeners: GeographicAuthErrorListener[] = [];

    subscribe(listener: GeographicAuthErrorListener): () => void {
        this.listeners.push(listener);
        
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    emit(): void {
        this.listeners.forEach(listener => listener());
    }
}

export const geographicFilterEvents = new GeographicFilterEventEmitter();
