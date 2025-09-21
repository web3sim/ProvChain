/**
 * Comprehensive Error Handling for ProvChain
 * 
 * This module provides centralized error handling, classification, and recovery
 * mechanisms for all ProvChain operations including storage, verification, and API.
 */

const winston = require('winston');

// Configure error logger
const errorLogger = winston.createLogger({
    level: 'error',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ 
            filename: 'logs/error.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Error types classification
const ErrorTypes = {
    STORAGE_ERROR: 'STORAGE_ERROR',
    VERIFICATION_ERROR: 'VERIFICATION_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
    RESOURCE_ERROR: 'RESOURCE_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

// Error severity levels
const ErrorSeverity = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

class ProvChainError extends Error {
    constructor(message, type = ErrorTypes.INTERNAL_ERROR, severity = ErrorSeverity.MEDIUM, details = {}) {
        super(message);
        this.name = 'ProvChainError';
        this.type = type;
        this.severity = severity;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.retryable = this.isRetryable();
        
        // Capture stack trace
        Error.captureStackTrace(this, ProvChainError);
    }

    isRetryable() {
        const retryableTypes = [
            ErrorTypes.NETWORK_ERROR,
            ErrorTypes.RATE_LIMIT_ERROR,
            ErrorTypes.STORAGE_ERROR
        ];
        return retryableTypes.includes(this.type);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            details: this.details,
            timestamp: this.timestamp,
            retryable: this.retryable,
            stack: this.stack
        };
    }
}

class StorageError extends ProvChainError {
    constructor(message, details = {}) {
        super(message, ErrorTypes.STORAGE_ERROR, ErrorSeverity.HIGH, details);
        this.name = 'StorageError';
    }
}

class VerificationError extends ProvChainError {
    constructor(message, details = {}) {
        super(message, ErrorTypes.VERIFICATION_ERROR, ErrorSeverity.HIGH, details);
        this.name = 'VerificationError';
    }
}

class NetworkError extends ProvChainError {
    constructor(message, details = {}) {
        super(message, ErrorTypes.NETWORK_ERROR, ErrorSeverity.MEDIUM, details);
        this.name = 'NetworkError';
    }
}

class ValidationError extends ProvChainError {
    constructor(message, details = {}) {
        super(message, ErrorTypes.VALIDATION_ERROR, ErrorSeverity.LOW, details);
        this.name = 'ValidationError';
    }
}

class RateLimitError extends ProvChainError {
    constructor(message, details = {}) {
        super(message, ErrorTypes.RATE_LIMIT_ERROR, ErrorSeverity.MEDIUM, details);
        this.name = 'RateLimitError';
    }
}

// Error handler for different operation types
class ErrorHandler {
    constructor() {
        this.errorStats = {
            totalErrors: 0,
            errorsByType: {},
            errorsBySeverity: {},
            recentErrors: []
        };
        
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 30000, // 30 seconds
            backoffMultiplier: 2
        };
    }

    // Log and track errors
    logError(error, context = {}) {
        const errorData = {
            ...error.toJSON(),
            context: context,
            id: this.generateErrorId()
        };

        errorLogger.error('ProvChain Error', errorData);

        // Update statistics
        this.updateErrorStats(error);

        return errorData;
    }

    // Update error statistics
    updateErrorStats(error) {
        this.errorStats.totalErrors++;
        
        // Count by type
        this.errorStats.errorsByType[error.type] = 
            (this.errorStats.errorsByType[error.type] || 0) + 1;
        
        // Count by severity
        this.errorStats.errorsBySeverity[error.severity] = 
            (this.errorStats.errorsBySeverity[error.severity] || 0) + 1;
        
        // Keep recent errors (last 100)
        this.errorStats.recentErrors.unshift({
            type: error.type,
            severity: error.severity,
            message: error.message,
            timestamp: error.timestamp
        });
        
        if (this.errorStats.recentErrors.length > 100) {
            this.errorStats.recentErrors = this.errorStats.recentErrors.slice(0, 100);
        }
    }

    // Generate unique error ID
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Retry mechanism with exponential backoff
    async withRetry(operation, context = {}, customConfig = {}) {
        const config = { ...this.retryConfig, ...customConfig };
        let lastError;
        
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                const result = await operation();
                
                if (attempt > 0) {
                    errorLogger.info('Operation succeeded after retry', {
                        context,
                        attempts: attempt + 1
                    });
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                // Convert to ProvChainError if needed
                if (!(error instanceof ProvChainError)) {
                    lastError = this.classifyError(error, context);
                }

                // Log the error
                this.logError(lastError, { ...context, attempt: attempt + 1 });

                // Don't retry if error is not retryable or on last attempt
                if (!lastError.retryable || attempt === config.maxRetries) {
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
                    config.maxDelay
                );

                errorLogger.warn('Retrying operation after delay', {
                    context,
                    attempt: attempt + 1,
                    maxRetries: config.maxRetries,
                    delay
                });

                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    // Sleep utility for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Classify unknown errors
    classifyError(error, context = {}) {
        const message = error.message || 'Unknown error';
        
        // Network-related errors
        if (message.includes('network') || 
            message.includes('timeout') || 
            message.includes('connection') ||
            message.includes('ECONNREFUSED') ||
            message.includes('ENOTFOUND')) {
            return new NetworkError(message, { originalError: error, context });
        }
        
        // Storage-related errors
        if (message.includes('storage') || 
            message.includes('filecoin') || 
            message.includes('lighthouse') ||
            message.includes('CID') ||
            message.includes('IPFS')) {
            return new StorageError(message, { originalError: error, context });
        }
        
        // Verification-related errors
        if (message.includes('verification') || 
            message.includes('proof') || 
            message.includes('integrity') ||
            message.includes('signature')) {
            return new VerificationError(message, { originalError: error, context });
        }
        
        // Rate limiting
        if (message.includes('rate limit') || 
            message.includes('429') || 
            message.includes('too many requests')) {
            return new RateLimitError(message, { originalError: error, context });
        }
        
        // Validation errors
        if (message.includes('invalid') || 
            message.includes('validation') || 
            message.includes('required') ||
            message.includes('format')) {
            return new ValidationError(message, { originalError: error, context });
        }
        
        // Default to internal error
        return new ProvChainError(message, ErrorTypes.INTERNAL_ERROR, ErrorSeverity.MEDIUM, { 
            originalError: error, 
            context 
        });
    }

    // Circuit breaker for failing services
    createCircuitBreaker(serviceName, threshold = 5, timeout = 60000) {
        const state = {
            failures: 0,
            lastFailure: null,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };

        return async (operation) => {
            // If circuit is open, check if timeout has passed
            if (state.state === 'OPEN') {
                if (Date.now() - state.lastFailure < timeout) {
                    throw new ProvChainError(
                        `Circuit breaker open for ${serviceName}`,
                        ErrorTypes.RESOURCE_ERROR,
                        ErrorSeverity.HIGH,
                        { serviceName, state: state.state }
                    );
                } else {
                    state.state = 'HALF_OPEN';
                }
            }

            try {
                const result = await operation();
                
                // Success - reset circuit breaker
                if (state.state === 'HALF_OPEN') {
                    state.state = 'CLOSED';
                    state.failures = 0;
                    errorLogger.info('Circuit breaker closed', { serviceName });
                }
                
                return result;
            } catch (error) {
                state.failures++;
                state.lastFailure = Date.now();
                
                if (state.failures >= threshold) {
                    state.state = 'OPEN';
                    errorLogger.warn('Circuit breaker opened', { 
                        serviceName, 
                        failures: state.failures,
                        threshold 
                    });
                }
                
                throw error;
            }
        };
    }

    // Graceful degradation helper
    async withFallback(primaryOperation, fallbackOperation, context = {}) {
        try {
            return await primaryOperation();
        } catch (error) {
            const provChainError = this.classifyError(error, context);
            this.logError(provChainError, { ...context, fallbackUsed: true });
            
            errorLogger.warn('Primary operation failed, using fallback', {
                context,
                error: provChainError.message
            });
            
            return await fallbackOperation();
        }
    }

    // Bulk operation error handling
    async withBulkErrorHandling(operations, context = {}) {
        const results = [];
        const errors = [];
        
        for (let i = 0; i < operations.length; i++) {
            try {
                const result = await operations[i]();
                results.push({ index: i, success: true, data: result });
            } catch (error) {
                const provChainError = this.classifyError(error, { ...context, operationIndex: i });
                this.logError(provChainError, context);
                
                results.push({ 
                    index: i, 
                    success: false, 
                    error: provChainError.toJSON() 
                });
                errors.push(provChainError);
            }
        }
        
        return {
            results,
            errors,
            successCount: results.filter(r => r.success).length,
            errorCount: errors.length,
            totalCount: operations.length
        };
    }

    // Get error statistics
    getErrorStats() {
        return {
            ...this.errorStats,
            healthScore: this.calculateHealthScore(),
            generatedAt: new Date().toISOString()
        };
    }

    // Calculate system health score based on errors
    calculateHealthScore() {
        if (this.errorStats.totalErrors === 0) return 100;
        
        const recentErrors = this.errorStats.recentErrors.slice(0, 50); // Last 50 errors
        const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;
        const highErrors = recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length;
        const mediumErrors = recentErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length;
        
        // Calculate weighted error score
        const errorScore = (criticalErrors * 10) + (highErrors * 5) + (mediumErrors * 2) + recentErrors.length;
        
        // Convert to health score (0-100)
        const healthScore = Math.max(0, 100 - errorScore);
        
        return Math.round(healthScore);
    }

    // Reset error statistics
    resetStats() {
        this.errorStats = {
            totalErrors: 0,
            errorsByType: {},
            errorsBySeverity: {},
            recentErrors: []
        };
        
        errorLogger.info('Error statistics reset');
    }
}

// Global error handler instance
const globalErrorHandler = new ErrorHandler();

// Express error middleware
const expressErrorHandler = (error, req, res, next) => {
    const provChainError = globalErrorHandler.classifyError(error, {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });

    const errorData = globalErrorHandler.logError(provChainError, {
        request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body
        }
    });

    // Determine HTTP status code
    let statusCode = 500;
    switch (provChainError.type) {
        case ErrorTypes.VALIDATION_ERROR:
            statusCode = 400;
            break;
        case ErrorTypes.AUTHENTICATION_ERROR:
            statusCode = 401;
            break;
        case ErrorTypes.RATE_LIMIT_ERROR:
            statusCode = 429;
            break;
        case ErrorTypes.NETWORK_ERROR:
        case ErrorTypes.STORAGE_ERROR:
            statusCode = 503;
            break;
        default:
            statusCode = 500;
    }

    res.status(statusCode).json({
        error: {
            message: provChainError.message,
            type: provChainError.type,
            severity: provChainError.severity,
            retryable: provChainError.retryable,
            errorId: errorData.id,
            timestamp: provChainError.timestamp
        }
    });
};

// Unhandled error listeners
process.on('uncaughtException', (error) => {
    const provChainError = globalErrorHandler.classifyError(error, { source: 'uncaughtException' });
    globalErrorHandler.logError(provChainError);
    
    errorLogger.error('Uncaught Exception - shutting down gracefully', { error: provChainError.toJSON() });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const provChainError = globalErrorHandler.classifyError(error, { 
        source: 'unhandledRejection',
        promise: promise.toString()
    });
    
    globalErrorHandler.logError(provChainError);
    
    errorLogger.error('Unhandled Rejection - shutting down gracefully', { error: provChainError.toJSON() });
    process.exit(1);
});

module.exports = {
    ErrorTypes,
    ErrorSeverity,
    ProvChainError,
    StorageError,
    VerificationError,
    NetworkError,
    ValidationError,
    RateLimitError,
    ErrorHandler,
    globalErrorHandler,
    expressErrorHandler
};