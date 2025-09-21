/**
 * ProvChain Deployment Configuration
 * 
 * This module provides deployment configurations for different environments
 * including development, staging, and production with proper Filecoin network settings.
 */

const path = require('path');

const deploymentConfig = {
    development: {
        environment: 'development',
        port: process.env.PORT || 3000,
        
        // Filecoin Network Configuration
        filecoin: {
            network: 'calibration', // Filecoin testnet
            lighthouse: {
                apiKey: process.env.LIGHTHOUSE_API_KEY || 'your_lighthouse_api_key',
                endpoint: 'https://node.lighthouse.storage',
                dealDuration: 518400, // ~6 months in epochs
                replicationFactor: 1
            },
            storacha: {
                email: process.env.STORACHA_EMAIL || 'your_email@example.com',
                endpoint: 'https://api.storacha.network',
                space: process.env.STORACHA_SPACE || 'your_space_did'
            },
            lotus: {
                apiUrl: process.env.LOTUS_API_URL || 'https://api.calibration.node.glif.io/rpc/v1',
                token: process.env.LOTUS_TOKEN || ''
            }
        },
        
        // Database Configuration
        database: {
            type: 'sqlite',
            storage: path.join(__dirname, '../data/dev.sqlite'),
            logging: console.log,
            synchronize: true
        },
        
        // Redis Configuration
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || '',
            db: 0
        },
        
        // Logging Configuration
        logging: {
            level: 'debug',
            console: true,
            files: {
                error: 'logs/error.log',
                combined: 'logs/combined.log'
            },
            maxFiles: 5,
            maxSize: '20m'
        },
        
        // API Configuration
        api: {
            cors: {
                origin: ['http://localhost:3000', 'http://localhost:3001'],
                credentials: true
            },
            rateLimiting: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000 // requests per window
            },
            bodyParser: {
                limit: '50mb'
            }
        },
        
        // Security Configuration
        security: {
            encryption: {
                algorithm: 'aes-256-gcm',
                keyPath: path.join(__dirname, '../keys/dev.key')
            },
            jwt: {
                secret: process.env.JWT_SECRET || 'dev_secret_key',
                expiresIn: '7d'
            }
        },
        
        // Performance Configuration
        performance: {
            caching: {
                ttl: 300, // 5 minutes
                maxItems: 1000
            },
            batch: {
                maxSize: 100,
                timeout: 30000 // 30 seconds
            },
            verification: {
                maxConcurrent: 10,
                timeout: 60000 // 1 minute
            }
        }
    },
    
    staging: {
        environment: 'staging',
        port: process.env.PORT || 8080,
        
        // Filecoin Network Configuration
        filecoin: {
            network: 'calibration', // Still testnet for staging
            lighthouse: {
                apiKey: process.env.LIGHTHOUSE_API_KEY,
                endpoint: 'https://node.lighthouse.storage',
                dealDuration: 1555200, // ~18 months
                replicationFactor: 2
            },
            storacha: {
                email: process.env.STORACHA_EMAIL,
                endpoint: 'https://api.storacha.network',
                space: process.env.STORACHA_SPACE
            },
            lotus: {
                apiUrl: process.env.LOTUS_API_URL || 'https://api.calibration.node.glif.io/rpc/v1',
                token: process.env.LOTUS_TOKEN
            }
        },
        
        // Database Configuration
        database: {
            type: 'postgres',
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: true,
            synchronize: false,
            logging: false
        },
        
        // Redis Configuration
        redis: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: 0,
            tls: process.env.REDIS_TLS === 'true' ? {} : false
        },
        
        // Logging Configuration
        logging: {
            level: 'info',
            console: false,
            files: {
                error: '/var/log/provchain/error.log',
                combined: '/var/log/provchain/combined.log'
            },
            maxFiles: 10,
            maxSize: '100m'
        },
        
        // API Configuration
        api: {
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
                credentials: true
            },
            rateLimiting: {
                windowMs: 15 * 60 * 1000,
                max: 500
            },
            bodyParser: {
                limit: '25mb'
            }
        },
        
        // Security Configuration
        security: {
            encryption: {
                algorithm: 'aes-256-gcm',
                keyPath: process.env.ENCRYPTION_KEY_PATH
            },
            jwt: {
                secret: process.env.JWT_SECRET,
                expiresIn: '24h'
            }
        },
        
        // Performance Configuration
        performance: {
            caching: {
                ttl: 600, // 10 minutes
                maxItems: 5000
            },
            batch: {
                maxSize: 50,
                timeout: 60000
            },
            verification: {
                maxConcurrent: 20,
                timeout: 120000
            }
        }
    },
    
    production: {
        environment: 'production',
        port: process.env.PORT || 8080,
        
        // Filecoin Network Configuration
        filecoin: {
            network: 'mainnet', // Production Filecoin mainnet
            lighthouse: {
                apiKey: process.env.LIGHTHOUSE_API_KEY,
                endpoint: 'https://node.lighthouse.storage',
                dealDuration: 3110400, // ~3 years
                replicationFactor: 3, // Higher replication for production
                verificationInterval: 86400000 // 24 hours
            },
            storacha: {
                email: process.env.STORACHA_EMAIL,
                endpoint: 'https://api.storacha.network',
                space: process.env.STORACHA_SPACE
            },
            lotus: {
                apiUrl: process.env.LOTUS_API_URL || 'https://api.node.glif.io/rpc/v1',
                token: process.env.LOTUS_TOKEN
            }
        },
        
        // Database Configuration
        database: {
            type: 'postgres',
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: true,
                ca: process.env.DB_SSL_CA
            },
            synchronize: false,
            logging: false,
            pool: {
                max: 20,
                min: 5,
                idle: 30000,
                acquire: 60000
            }
        },
        
        // Redis Configuration
        redis: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: 0,
            tls: {
                rejectUnauthorized: true
            },
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        },
        
        // Logging Configuration
        logging: {
            level: 'warn',
            console: false,
            files: {
                error: '/var/log/provchain/error.log',
                combined: '/var/log/provchain/combined.log',
                audit: '/var/log/provchain/audit.log'
            },
            maxFiles: 30,
            maxSize: '500m',
            compress: true
        },
        
        // API Configuration
        api: {
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
                credentials: true
            },
            rateLimiting: {
                windowMs: 15 * 60 * 1000,
                max: 100 // Stricter rate limiting for production
            },
            bodyParser: {
                limit: '10mb'
            }
        },
        
        // Security Configuration
        security: {
            encryption: {
                algorithm: 'aes-256-gcm',
                keyPath: process.env.ENCRYPTION_KEY_PATH
            },
            jwt: {
                secret: process.env.JWT_SECRET,
                expiresIn: '1h'
            },
            helmet: {
                contentSecurityPolicy: true,
                hsts: true
            }
        },
        
        // Performance Configuration
        performance: {
            caching: {
                ttl: 3600, // 1 hour
                maxItems: 10000
            },
            batch: {
                maxSize: 25,
                timeout: 120000
            },
            verification: {
                maxConcurrent: 50,
                timeout: 300000 // 5 minutes
            }
        },
        
        // Monitoring Configuration
        monitoring: {
            healthCheck: {
                interval: 30000, // 30 seconds
                timeout: 5000
            },
            metrics: {
                collectInterval: 60000, // 1 minute
                retention: 2592000000 // 30 days
            },
            alerts: {
                errorThreshold: 10,
                responseTimeThreshold: 5000,
                storageFailureThreshold: 5
            }
        }
    }
};

// Get configuration based on environment
function getConfig() {
    const env = process.env.NODE_ENV || 'development';
    const config = deploymentConfig[env];
    
    if (!config) {
        throw new Error(`Invalid environment: ${env}`);
    }
    
    return config;
}

// Validate configuration
function validateConfig(config) {
    const required = [
        'filecoin.lighthouse.apiKey',
        'filecoin.storacha.email',
        'security.jwt.secret'
    ];
    
    for (const path of required) {
        const keys = path.split('.');
        let value = config;
        
        for (const key of keys) {
            value = value?.[key];
        }
        
        if (!value) {
            throw new Error(`Missing required configuration: ${path}`);
        }
    }
    
    return true;
}

// Docker configuration
const dockerConfig = {
    image: 'provchain:latest',
    
    development: {
        ports: ['3000:3000'],
        volumes: [
            './data:/app/data',
            './logs:/app/logs',
            './keys:/app/keys'
        ],
        environment: [
            'NODE_ENV=development'
        ]
    },
    
    production: {
        ports: ['8080:8080'],
        volumes: [
            '/var/lib/provchain:/app/data',
            '/var/log/provchain:/app/logs'
        ],
        environment: [
            'NODE_ENV=production'
        ],
        restart: 'unless-stopped',
        healthcheck: {
            test: ['CMD', 'curl', '-f', 'http://localhost:8080/health'],
            interval: '30s',
            timeout: '10s',
            retries: 3
        }
    }
};

// Kubernetes configuration
const kubernetesConfig = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
        name: 'provchain',
        labels: {
            app: 'provchain'
        }
    },
    spec: {
        replicas: 3,
        selector: {
            matchLabels: {
                app: 'provchain'
            }
        },
        template: {
            metadata: {
                labels: {
                    app: 'provchain'
                }
            },
            spec: {
                containers: [
                    {
                        name: 'provchain',
                        image: 'provchain:latest',
                        ports: [
                            {
                                containerPort: 8080
                            }
                        ],
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            }
                        ],
                        livenessProbe: {
                            httpGet: {
                                path: '/health',
                                port: 8080
                            },
                            initialDelaySeconds: 30,
                            periodSeconds: 30
                        },
                        readinessProbe: {
                            httpGet: {
                                path: '/ready',
                                port: 8080
                            },
                            initialDelaySeconds: 5,
                            periodSeconds: 10
                        },
                        resources: {
                            requests: {
                                memory: '512Mi',
                                cpu: '250m'
                            },
                            limits: {
                                memory: '2Gi',
                                cpu: '1000m'
                            }
                        }
                    }
                ]
            }
        }
    }
};

module.exports = {
    deploymentConfig,
    getConfig,
    validateConfig,
    dockerConfig,
    kubernetesConfig
};