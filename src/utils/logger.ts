/**
 * Debug Logger Utility
 * Provides conditional logging that only outputs in development mode with verbose logging enabled
 */

// Set to false to reduce console noise in development
const VERBOSE_LOGGING = false;

/**
 * Log debug messages only when verbose logging is enabled and in DEV mode
 */
export const debugLog = (category: string, message: string, data?: object): void => {
    if (__DEV__ && VERBOSE_LOGGING) {
        if (data) {
            console.log(`[${category}] ${message}`, data);
        } else {
            console.log(`[${category}] ${message}`);
        }
    }
};

/**
 * Log important info messages (always shown in DEV)
 */
export const infoLog = (category: string, message: string, data?: object): void => {
    if (__DEV__) {
        if (data) {
            console.log(`[${category}] ${message}`, data);
        } else {
            console.log(`[${category}] ${message}`);
        }
    }
};

/**
 * Log warnings (always shown)
 */
export const warnLog = (category: string, message: string, data?: object): void => {
    if (data) {
        console.warn(`[${category}] ${message}`, data);
    } else {
        console.warn(`[${category}] ${message}`);
    }
};

/**
 * Log errors (always shown)
 */
export const errorLog = (category: string, message: string, error?: unknown): void => {
    if (error) {
        console.error(`[${category}] ${message}`, error);
    } else {
        console.error(`[${category}] ${message}`);
    }
};

// Enable/disable verbose logging dynamically (for debugging)
export const setVerboseLogging = (enabled: boolean): void => {
    // This would need to be implemented with a mutable variable if dynamic control is needed
    console.log(`Verbose logging ${enabled ? 'enabled' : 'disabled'}`);
};
