/**
 * ProvChain MVP Demo
 * 
 * This demo showcases the complete ProvChain system with real Filecoin integration,
 * comprehensive verification, and full provenance tracking.
 */

const { ProvChainGraph, ProvenanceNode, ProvenanceEdge } = require('./provchain-core');
const { FilecoinStorage } = require('./filecoin-storage-demo');
const { globalErrorHandler, StorageError, VerificationError } = require('./error-handling');
const winston = require('winston');

// Configure demo logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/demo.log' })
    ]
});

class ProvChainDemo {
    constructor() {
        this.graph = new ProvChainGraph();
        this.storage = new FilecoinStorage();
        this.nodeIds = [];
        this.stats = {
            nodesCreated: 0,
            nodesStored: 0,
            edgesCreated: 0,
            verificationsPassed: 0,
            verificationsFailed: 0,
            startTime: null,
            endTime: null
        };
    }

    async runFullDemo() {
        logger.info('🚀 Starting ProvChain MVP Demo');
        this.stats.startTime = new Date();

        try {
            // Phase 1: Create data with provenance tracking
            await this.demoDataCreation();
            
            // Phase 2: Show real Filecoin storage integration
            await this.demoFilecoinStorage();
            
            // Phase 3: Demonstrate verification and integrity
            await this.demoVerificationSystem();
            
            // Phase 4: Show provenance tracking and queries
            await this.demoProvenanceQueries();
            
            // Phase 5: Demonstrate batch operations
            await this.demoBatchOperations();
            
            // Phase 6: Show error handling and recovery
            await this.demoErrorHandling();
            
            // Phase 7: Display final statistics and metrics
            await this.demoMetricsAndReporting();
            
            this.stats.endTime = new Date();
            logger.info('✅ ProvChain MVP Demo completed successfully!', {
                duration: `${this.stats.endTime - this.stats.startTime}ms`,
                stats: this.stats
            });
            
        } catch (error) {
            logger.error('❌ Demo failed', { error: error.message });
            throw error;
        }
    }

    async demoDataCreation() {
        logger.info('\n📊 Phase 1: Data Creation with Provenance');
        
        // Create original research data
        const researchData = {
            title: "Climate Change Impact Analysis",
            methodology: "Machine Learning Analysis of Satellite Data",
            dataset: "NASA Climate Observation Data 2020-2024",
            findings: "Temperature increase of 1.2°C in polar regions",
            confidence: 0.95,
            researcher: "Dr. Jane Smith",
            institution: "Climate Research Institute"
        };

        const researchNode = new ProvenanceNode(JSON.stringify(researchData), {
            nodeType: 'research_data',
            createdBy: 'dr_jane_smith',
            domain: 'climate_science',
            confidentiality: 'public'
        });
        
        researchNode.addTag('climate-change');
        researchNode.addTag('machine-learning');
        researchNode.addTag('satellite-data');

        this.graph.addNode(researchNode);
        this.nodeIds.push(researchNode.id);
        this.stats.nodesCreated++;

        logger.info('✅ Created research data node', { 
            nodeId: researchNode.id,
            dataSize: researchNode.metadata.dataSize,
            tags: researchNode.tags
        });

        // Create processed data with transformation
        const processedData = {
            ...researchData,
            processing: {
                algorithm: "Deep Neural Network",
                version: "2.1.0",
                parameters: {
                    layers: 5,
                    neurons_per_layer: 128,
                    learning_rate: 0.001
                },
                processing_time: "4.5 hours",
                accuracy: 0.97
            },
            processed_at: new Date().toISOString()
        };

        const processedNode = new ProvenanceNode(JSON.stringify(processedData), {
            nodeType: 'processed_data',
            createdBy: 'ai_processor_v2',
            derivedFrom: researchNode.id,
            domain: 'climate_science'
        });

        processedNode.addTag('processed');
        processedNode.addTag('ai-analysis');

        this.graph.addNode(processedNode);
        this.nodeIds.push(processedNode.id);
        this.stats.nodesCreated++;

        // Create transformation edge
        const transformationEdge = new ProvenanceEdge(
            researchNode.id,
            processedNode.id,
            'data_processing'
        );

        transformationEdge.setTransformationDetails({
            method: 'deep_neural_network_analysis',
            parameters: processedData.processing.parameters,
            inputData: JSON.stringify(researchData),
            outputData: JSON.stringify(processedData),
            operator: 'ai_processor_v2'
        });

        this.graph.addEdge(transformationEdge);
        this.stats.edgesCreated++;

        logger.info('✅ Created processed data with transformation edge', {
            sourceNodeId: researchNode.id,
            targetNodeId: processedNode.id,
            edgeId: transformationEdge.id,
            transformationProof: !!transformationEdge.transformationProof
        });

        // Create analysis results
        const analysisData = {
            summary: "Accelerated warming detected in Arctic regions",
            recommendations: [
                "Immediate carbon emission reduction",
                "Enhanced monitoring systems",
                "International climate action"
            ],
            risk_assessment: "HIGH",
            confidence_interval: [0.92, 0.98],
            analyzed_by: "Climate Analysis AI",
            analysis_date: new Date().toISOString()
        };

        const analysisNode = new ProvenanceNode(JSON.stringify(analysisData), {
            nodeType: 'analysis_results',
            createdBy: 'climate_analysis_ai',
            derivedFrom: processedNode.id,
            domain: 'climate_science'
        });

        analysisNode.addTag('analysis');
        analysisNode.addTag('recommendations');

        this.graph.addNode(analysisNode);
        this.nodeIds.push(analysisNode.id);
        this.stats.nodesCreated++;

        // Create analysis edge
        const analysisEdge = new ProvenanceEdge(
            processedNode.id,
            analysisNode.id,
            'data_analysis'
        );

        this.graph.addEdge(analysisEdge);
        this.stats.edgesCreated++;

        logger.info('✅ Created analysis results with provenance chain', {
            totalNodes: this.stats.nodesCreated,
            totalEdges: this.stats.edgesCreated
        });
    }

    async demoFilecoinStorage() {
        logger.info('\n🗄️  Phase 2: Filecoin Storage Integration');

        for (let i = 0; i < this.nodeIds.length; i++) {
            const nodeId = this.nodeIds[i];
            const node = this.graph.getNode(nodeId);

            try {
                logger.info(`Storing node ${i + 1}/${this.nodeIds.length} on Filecoin...`, {
                    nodeId: node.id,
                    nodeType: node.metadata.nodeType,
                    dataSize: node.metadata.dataSize
                });

                // Store with error handling and retry
                const storageResult = await globalErrorHandler.withRetry(
                    async () => await this.storage.store(node.data),
                    { operation: 'filecoin_storage', nodeId: node.id }
                );

                await node.linkToFilecoin(storageResult.cid, storageResult.proof);
                this.stats.nodesStored++;

                logger.info('✅ Node stored successfully', {
                    nodeId: node.id,
                    cid: storageResult.cid,
                    deals: storageResult.proof.deals?.length || 0,
                    proofAlgorithm: storageResult.proof.algorithm
                });

            } catch (error) {
                logger.warn('⚠️  Storage failed for node', {
                    nodeId: node.id,
                    error: error.message
                });
                // Continue with demo even if some storage fails
            }
        }

        logger.info('📈 Storage phase completed', {
            totalNodes: this.stats.nodesCreated,
            storedNodes: this.stats.nodesStored,
            storageRate: `${Math.round((this.stats.nodesStored / this.stats.nodesCreated) * 100)}%`
        });
    }

    async demoVerificationSystem() {
        logger.info('\n🔐 Phase 3: Verification and Integrity Checking');

        for (const nodeId of this.nodeIds) {
            const node = this.graph.getNode(nodeId);
            
            if (!node.cid) {
                logger.info('⏭️  Skipping verification for unstored node', { nodeId });
                continue;
            }

            try {
                logger.info('Verifying node integrity...', {
                    nodeId: node.id,
                    cid: node.cid
                });

                // Verify with comprehensive error handling
                await globalErrorHandler.withRetry(
                    async () => await node.verify(this.storage),
                    { operation: 'verification', nodeId: node.id, cid: node.cid }
                );

                this.stats.verificationsPassed++;

                const verificationStatus = node.getVerificationStatus();
                logger.info('✅ Verification successful', {
                    nodeId: node.id,
                    cid: node.cid,
                    verificationStatus
                });

            } catch (error) {
                this.stats.verificationsFailed++;
                logger.error('❌ Verification failed', {
                    nodeId: node.id,
                    cid: node.cid,
                    error: error.message
                });
            }
        }

        logger.info('📊 Verification phase completed', {
            verificationsPassed: this.stats.verificationsPassed,
            verificationsFailed: this.stats.verificationsFailed,
            successRate: `${Math.round((this.stats.verificationsPassed / (this.stats.verificationsPassed + this.stats.verificationsFailed)) * 100)}%`
        });
    }

    async demoProvenanceQueries() {
        logger.info('\n🔍 Phase 4: Provenance Tracking and Queries');

        // Find the analysis node (should be the last one)
        const analysisNodeId = this.nodeIds[this.nodeIds.length - 1];
        
        logger.info('Tracing complete provenance chain...', { analysisNodeId });

        // Get full provenance
        const provenance = this.graph.getProvenance(analysisNodeId);
        
        logger.info('✅ Provenance chain retrieved', {
            analysisNodeId,
            pathsFound: provenance.length,
            totalStepsInLongestPath: Math.max(...provenance.map(path => path.length))
        });

        // Show each path in the provenance
        provenance.forEach((path, pathIndex) => {
            logger.info(`📋 Provenance Path ${pathIndex + 1}:`, {
                pathLength: path.length,
                steps: path.map(step => ({
                    nodeId: step.node.id,
                    nodeType: step.node.metadata.nodeType,
                    hasStorage: !!step.node.cid,
                    relationship: step.edge?.relationshipType
                }))
            });
        });

        // Verify provenance integrity
        logger.info('Verifying provenance integrity...');
        
        try {
            const verificationResults = await this.graph.verifyProvenance(analysisNodeId, this.storage);
            
            const validPaths = verificationResults.filter(result => result.valid).length;
            const totalPaths = verificationResults.length;
            
            logger.info('✅ Provenance verification completed', {
                totalPaths,
                validPaths,
                verificationRate: `${Math.round((validPaths / totalPaths) * 100)}%`,
                errors: verificationResults.flatMap(r => r.errors)
            });
            
        } catch (error) {
            logger.error('❌ Provenance verification failed', { error: error.message });
        }

        // Demonstrate queries
        logger.info('Running graph queries...');

        const queries = [
            { nodeType: 'research_data' },
            { nodeType: 'processed_data' },
            { nodeType: 'analysis_results' },
            { tags: ['climate-change'] },
            { verified: true }
        ];

        for (const query of queries) {
            const results = this.graph.query(query);
            logger.info('📊 Query results', {
                query,
                resultsCount: results.length,
                nodeIds: results.map(r => r.id)
            });
        }
    }

    async demoBatchOperations() {
        logger.info('\n⚡ Phase 5: Batch Operations Demo');

        // Create multiple related nodes in batch
        const batchData = [
            {
                title: "Supplementary Dataset 1",
                type: "satellite_imagery",
                source: "NOAA Satellites"
            },
            {
                title: "Supplementary Dataset 2", 
                type: "weather_station_data",
                source: "Global Weather Network"
            },
            {
                title: "Validation Results",
                type: "validation_data",
                source: "Independent Research Lab"
            }
        ];

        const batchNodes = [];
        const batchOperations = [];

        // Prepare batch storage operations
        for (const data of batchData) {
            const node = new ProvenanceNode(JSON.stringify(data), {
                nodeType: data.type,
                createdBy: 'batch_processor',
                domain: 'climate_science'
            });

            node.addTag('supplementary');
            node.addTag('batch-created');

            this.graph.addNode(node);
            batchNodes.push(node);

            // Add storage operation to batch
            batchOperations.push(async () => {
                const storageResult = await this.storage.store(node.data);
                await node.linkToFilecoin(storageResult.cid, storageResult.proof);
                return { nodeId: node.id, cid: storageResult.cid };
            });
        }

        logger.info('Executing batch storage operations...', { operationsCount: batchOperations.length });

        // Execute batch with error handling
        const batchResults = await globalErrorHandler.withBulkErrorHandling(
            batchOperations,
            { operation: 'batch_storage' }
        );

        logger.info('✅ Batch operations completed', {
            totalOperations: batchResults.totalCount,
            successful: batchResults.successCount,
            failed: batchResults.errorCount,
            successRate: `${Math.round((batchResults.successCount / batchResults.totalCount) * 100)}%`
        });

        // Show batch results
        batchResults.results.forEach((result, index) => {
            if (result.success) {
                logger.info(`✅ Batch item ${index + 1} stored`, result.data);
            } else {
                logger.warn(`❌ Batch item ${index + 1} failed`, { error: result.error.message });
            }
        });

        this.stats.nodesCreated += batchNodes.length;
        this.stats.nodesStored += batchResults.successCount;
    }

    async demoErrorHandling() {
        logger.info('\n🛡️  Phase 6: Error Handling and Recovery Demo');

        // Simulate various error scenarios
        const errorScenarios = [
            {
                name: 'Network Timeout',
                operation: async () => {
                    throw new Error('network timeout after 30s');
                }
            },
            {
                name: 'Invalid CID',
                operation: async () => {
                    return await this.storage.verifyStorageProof('invalid_cid_format', 'test data');
                }
            },
            {
                name: 'Storage Service Unavailable',
                operation: async () => {
                    throw new Error('storage service temporarily unavailable');
                }
            }
        ];

        for (const scenario of errorScenarios) {
            logger.info(`Testing error scenario: ${scenario.name}`);

            try {
                await globalErrorHandler.withRetry(
                    scenario.operation,
                    { operation: 'error_demo', scenario: scenario.name }
                );
            } catch (error) {
                logger.info('✅ Error handled gracefully', {
                    scenario: scenario.name,
                    errorType: error.type || 'unclassified',
                    retryable: error.retryable,
                    severity: error.severity
                });
            }
        }

        // Show error statistics
        const errorStats = globalErrorHandler.getErrorStats();
        logger.info('📊 Error handling statistics', {
            totalErrors: errorStats.totalErrors,
            errorsByType: errorStats.errorsByType,
            healthScore: errorStats.healthScore
        });
    }

    async demoMetricsAndReporting() {
        logger.info('\n📈 Phase 7: Metrics and Reporting');

        // Get comprehensive graph metrics
        const graphMetrics = this.graph.getGraphMetrics();
        logger.info('📊 Graph Metrics', graphMetrics);

        // Get storage metrics
        const storageMetrics = await this.storage.getStorageMetrics();
        logger.info('🗄️  Storage Metrics', storageMetrics);

        // Export graph for analysis
        const graphExport = this.graph.exportGraph();
        logger.info('📁 Graph Export Summary', {
            nodes: graphExport.nodes.length,
            edges: graphExport.edges.length,
            verifiedNodes: graphExport.nodes.filter(n => n.cid).length,
            totalDataSize: graphExport.metadata.totalStorage,
            exportSize: JSON.stringify(graphExport).length
        });

        // Generate compliance report for the main analysis node
        if (this.nodeIds.length > 0) {
            const mainNodeId = this.nodeIds[this.nodeIds.length - 1];
            const mainNode = this.graph.getNode(mainNodeId);
            
            if (mainNode) {
                const provenance = this.graph.getProvenance(mainNodeId);
                const verificationResults = await this.graph.verifyProvenance(mainNodeId, this.storage);
                
                const complianceReport = {
                    nodeId: mainNodeId,
                    dataType: mainNode.metadata.nodeType,
                    provenanceComplete: provenance.length > 0,
                    verificationPassed: verificationResults.every(r => r.valid),
                    storageVerified: !!mainNode.cid,
                    complianceScore: this.calculateComplianceScore(mainNode, provenance, verificationResults),
                    generatedAt: new Date().toISOString()
                };

                logger.info('📋 Compliance Report', complianceReport);
            }
        }

        // Final demo statistics
        const demoStats = {
            ...this.stats,
            duration: this.stats.endTime ? this.stats.endTime - this.stats.startTime : 'ongoing',
            storageSuccessRate: Math.round((this.stats.nodesStored / this.stats.nodesCreated) * 100),
            verificationSuccessRate: Math.round((this.stats.verificationsPassed / (this.stats.verificationsPassed + this.stats.verificationsFailed)) * 100)
        };

        logger.info('🎯 Final Demo Statistics', demoStats);

        return demoStats;
    }

    calculateComplianceScore(node, provenance, verificationResults) {
        let score = 0;
        
        // Base score for node existence
        score += 20;
        
        // Storage on Filecoin
        if (node.cid) score += 30;
        
        // Provenance tracking
        if (provenance.length > 0) score += 25;
        
        // Verification success
        if (verificationResults.every(r => r.valid)) score += 25;
        
        return Math.min(score, 100);
    }
}

// Self-executing demo function
async function runDemo() {
    const demo = new ProvChainDemo();
    
    try {
        const results = await demo.runFullDemo();
        
        console.log('\n🎉 ProvChain MVP Demo completed successfully!');
        console.log('📊 Summary:', JSON.stringify(results, null, 2));
        
        return results;
        
    } catch (error) {
        console.error('\n💥 Demo failed:', error.message);
        console.error('🔍 Error details:', error);
        
        // Show error statistics even on failure
        const errorStats = globalErrorHandler.getErrorStats();
        console.log('📊 Error Statistics:', JSON.stringify(errorStats, null, 2));
        
        throw error;
    }
}

// Export for use as module or run directly
if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = {
    ProvChainDemo,
    runDemo
};