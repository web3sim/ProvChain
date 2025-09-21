/**
 * GraphQL API for ProvChain
 * 
 * This module provides a GraphQL interface for querying the provenance graph
 * with built-in verification and compliance features.
 */

const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { GraphQLScalarType, Kind } = require('graphql');

// Custom scalar for CID
const CIDScalar = new GraphQLScalarType({
    name: 'CID',
    description: 'Content Identifier for Filecoin storage',
    serialize(value) {
        return value;
    },
    parseValue(value) {
        return value;
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
            return ast.value;
        }
        return null;
    },
});

// GraphQL schema definition
const typeDefs = `
    scalar CID
    scalar DateTime

    type ProvenanceNode {
        id: ID!
        data: String!
        metadata: JSON
        cid: CID
        pdpProof: PDPProof
        createdAt: DateTime!
        updatedAt: DateTime!
        version: Int!
        verified: Boolean!
    }

    type ProvenanceEdge {
        id: ID!
        sourceId: ID!
        targetId: ID!
        relationshipType: String!
        transformationProof: String
        createdAt: DateTime!
        weight: Float!
    }

    type PDPProof {
        algorithm: String!
        proof: String!
        generatedAt: DateTime!
        cid: CID!
    }

    type ProvenancePath {
        nodes: [ProvenanceNode!]!
        edges: [ProvenanceEdge!]!
        valid: Boolean!
        verifiedAt: DateTime!
    }

    type QueryResult {
        nodes: [ProvenanceNode!]!
        totalCount: Int!
        hasNextPage: Boolean!
        cursor: String
    }

    type VerificationResult {
        valid: Boolean!
        cid: CID!
        verifiedAt: DateTime!
        source: String!
        error: String
    }

    type ComplianceReport {
        reportId: ID!
        nodeId: ID!
        complianceType: String!
        status: String!
        findings: [String!]!
        generatedAt: DateTime!
        validUntil: DateTime!
    }

    input NodeFilter {
        nodeType: String
        createdAfter: DateTime
        createdBefore: DateTime
        verified: Boolean
        hasProvenance: Boolean
    }

    input ProvenanceQuery {
        nodeId: ID!
        maxDepth: Int = 10
        includeTransformations: Boolean = true
    }

    type Query {
        # Node queries
        node(id: ID!): ProvenanceNode
        nodes(filter: NodeFilter, limit: Int = 10, cursor: String): QueryResult!
        nodesByCid(cids: [CID!]!): [ProvenanceNode]!
        
        # Provenance queries
        provenance(query: ProvenanceQuery!): [ProvenancePath!]!
        verifyProvenance(nodeId: ID!): [VerificationResult!]!
        
        # Verification queries
        verifyIntegrity(cid: CID!): VerificationResult!
        batchVerify(cids: [CID!]!): [VerificationResult!]!
        
        # Compliance queries
        complianceReport(nodeId: ID!, type: String!): ComplianceReport!
        auditTrail(nodeId: ID!, fromDate: DateTime, toDate: DateTime): [ProvenanceNode!]!
        
        # Analytics
        graphStats: GraphStats!
        verificationStats(timeRange: String = "24h"): VerificationStats!
    }

    type GraphStats {
        nodeCount: Int!
        edgeCount: Int!
        verifiedNodes: Int!
        totalDataSize: Float!
        averageVerificationTime: Float!
    }

    type VerificationStats {
        totalVerifications: Int!
        successfulVerifications: Int!
        failedVerifications: Int!
        averageTime: Float!
        timeRange: String!
    }

    input CreateNodeInput {
        data: String!
        metadata: JSON
        linkToFilecoin: Boolean = true
    }

    input CreateEdgeInput {
        sourceId: ID!
        targetId: ID!
        relationshipType: String!
        transformationProof: String
    }

    type Mutation {
        # Node operations
        createNode(input: CreateNodeInput!): ProvenanceNode!
        updateNode(id: ID!, data: String, metadata: JSON): ProvenanceNode!
        deleteNode(id: ID!): Boolean!
        
        # Edge operations
        createEdge(input: CreateEdgeInput!): ProvenanceEdge!
        deleteEdge(id: ID!): Boolean!
        
        # Storage operations
        storeData(data: String!, metadata: JSON): ProvenanceNode!
        batchStore(items: [CreateNodeInput!]!): [ProvenanceNode!]!
        
        # Verification operations
        generatePDPProof(nodeId: ID!): PDPProof!
        refreshVerification(nodeId: ID!): VerificationResult!
    }

    type Subscription {
        nodeCreated: ProvenanceNode!
        nodeUpdated: ProvenanceNode!
        verificationCompleted: VerificationResult!
        complianceAlert: ComplianceReport!
    }

    scalar JSON
`;

// Import our enhanced modules
const { ProvChainGraph, ProvenanceNode, ProvenanceEdge } = require('./provchain-core');
const { FilecoinStorage } = require('./filecoin-storage');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Global instances
const graph = new ProvChainGraph();
const storage = new FilecoinStorage();

// Resolvers
const resolvers = {
    CID: CIDScalar,
    
    DateTime: new GraphQLScalarType({
        name: 'DateTime',
        description: 'ISO 8601 date time string',
        serialize: (value) => new Date(value).toISOString(),
        parseValue: (value) => new Date(value),
        parseLiteral: (ast) => {
            if (ast.kind === Kind.STRING) {
                return new Date(ast.value);
            }
            return null;
        },
    }),

    JSON: new GraphQLScalarType({
        name: 'JSON',
        serialize: (value) => value,
        parseValue: (value) => value,
        parseLiteral: (ast) => {
            if (ast.kind === Kind.STRING) {
                return JSON.parse(ast.value);
            }
            return null;
        },
    }),

    Query: {
        node: async (_, { id }) => {
            try {
                const node = graph.getNode(id);
                if (!node) {
                    logger.warn('Node not found', { nodeId: id });
                    return null;
                }

                const verificationStatus = node.getVerificationStatus();
                
                // Verify integrity if stored on Filecoin
                if (node.cid) {
                    try {
                        await node.verify(storage);
                    } catch (error) {
                        logger.warn('Node verification failed', { nodeId: id, error: error.message });
                    }
                }

                logger.info('Node retrieved', { nodeId: id, hasStorage: !!node.cid });
                
                return {
                    ...node.toJSON(),
                    verified: verificationStatus.verified
                };
            } catch (error) {
                logger.error('Error retrieving node', { nodeId: id, error: error.message });
                throw new Error(`Failed to retrieve node: ${error.message}`);
            }
        },

        nodes: async (_, { filter, limit = 10, cursor }) => {
            try {
                const query = {
                    nodeType: filter?.nodeType,
                    verified: filter?.verified,
                    limit: Math.min(limit, 100), // Cap at 100
                    offset: cursor ? parseInt(cursor) : 0
                };

                if (filter?.createdAfter || filter?.createdBefore) {
                    query.dateRange = {
                        start: filter.createdAfter ? filter.createdAfter.toISOString().split('T')[0] : '1970-01-01',
                        end: filter.createdBefore ? filter.createdBefore.toISOString().split('T')[0] : '2099-12-31'
                    };
                }
                
                const results = graph.query(query);
                
                logger.info('Nodes query executed', { 
                    filtersApplied: Object.keys(filter || {}).length,
                    resultsCount: results.length 
                });
                
                return {
                    nodes: results,
                    totalCount: results.length,
                    hasNextPage: results.length === limit,
                    cursor: results.length > 0 ? String(query.offset + results.length) : null
                };
            } catch (error) {
                logger.error('Error querying nodes', { error: error.message });
                throw new Error(`Failed to query nodes: ${error.message}`);
            }
        },

        nodesByCid: async (_, { cids }) => {
            try {
                const nodes = [];
                for (const cid of cids) {
                    const node = graph.getNodeByCid(cid);
                    if (node) {
                        const verificationStatus = node.getVerificationStatus();
                        
                        // Verify integrity
                        try {
                            await node.verify(storage);
                        } catch (error) {
                            logger.warn('Node verification failed', { cid, error: error.message });
                        }

                        nodes.push({
                            ...node.toJSON(),
                            verified: verificationStatus.verified
                        });
                    }
                }

                logger.info('Nodes retrieved by CIDs', { 
                    requestedCids: cids.length,
                    foundNodes: nodes.length 
                });
                
                return nodes;
            } catch (error) {
                logger.error('Error retrieving nodes by CIDs', { error: error.message });
                throw new Error(`Failed to retrieve nodes by CIDs: ${error.message}`);
            }
        },

        provenance: async (_, { query: provenanceQuery }) => {
            try {
                const provenance = graph.getProvenance(
                    provenanceQuery.nodeId, 
                    provenanceQuery.maxDepth || 10
                );
                const paths = [];
                
                for (const path of provenance) {
                    const nodes = path.map(step => step.node).filter(Boolean);
                    const edges = path.map(step => step.edge).filter(Boolean);
                    
                    // Verify each path if requested
                    let valid = true;
                    if (provenanceQuery.includeTransformations) {
                        for (const node of nodes) {
                            if (node.cid) {
                                try {
                                    await node.verify(storage);
                                } catch (error) {
                                    valid = false;
                                    logger.warn('Path verification failed', { 
                                        nodeId: node.id, 
                                        error: error.message 
                                    });
                                    break;
                                }
                            }
                        }
                    }
                    
                    paths.push({
                        nodes: nodes.map(n => ({ 
                            ...n.toJSON(), 
                            verified: valid && !!n.cid 
                        })),
                        edges: edges.map(e => e.toJSON()),
                        valid: valid,
                        verifiedAt: new Date().toISOString()
                    });
                }

                logger.info('Provenance retrieved', { 
                    nodeId: provenanceQuery.nodeId,
                    pathsFound: paths.length 
                });
                
                return paths;
            } catch (error) {
                logger.error('Error retrieving provenance', { 
                    nodeId: provenanceQuery.nodeId, 
                    error: error.message 
                });
                throw new Error(`Failed to retrieve provenance: ${error.message}`);
            }
        },

        verifyProvenance: async (_, { nodeId }) => {
            try {
                const verificationResults = await graph.verifyProvenance(nodeId, storage);
                const results = [];
                
                for (const result of verificationResults) {
                    for (const step of result.path) {
                        if (step.node && step.node.cid) {
                            const verificationStatus = step.node.getVerificationStatus();
                            results.push({
                                valid: result.valid && verificationStatus.verified,
                                cid: step.node.cid,
                                verifiedAt: result.verifiedAt,
                                source: 'filecoin_storage',
                                error: result.errors.length > 0 ? result.errors[0].error : null
                            });
                        }
                    }
                }

                logger.info('Provenance verification completed', { 
                    nodeId,
                    verificationsPerformed: results.length 
                });
                
                return results;
            } catch (error) {
                logger.error('Error verifying provenance', { nodeId, error: error.message });
                throw new Error(`Failed to verify provenance: ${error.message}`);
            }
        },

        verifyIntegrity: async (_, { cid }) => {
            try {
                const node = graph.getNodeByCid(cid);
                if (!node) {
                    return {
                        valid: false,
                        cid: cid,
                        verifiedAt: new Date().toISOString(),
                        source: 'graph_lookup',
                        error: 'Node not found in graph'
                    };
                }

                const isValid = await storage.verifyStorageProof(cid, node.data);

                logger.info('Integrity verification completed', { cid, valid: isValid });

                return {
                    valid: isValid,
                    cid: cid,
                    verifiedAt: new Date().toISOString(),
                    source: 'filecoin_storage',
                    error: isValid ? null : 'Storage proof verification failed'
                };
            } catch (error) {
                logger.error('Error verifying integrity', { cid, error: error.message });
                return {
                    valid: false,
                    cid: cid,
                    verifiedAt: new Date().toISOString(),
                    source: 'error_handler',
                    error: error.message
                };
            }
        },

        batchVerify: async (_, { cids }) => {
            try {
                const results = [];
                for (const cid of cids) {
                    const result = await resolvers.Query.verifyIntegrity(_, { cid });
                    results.push(result);
                }

                logger.info('Batch verification completed', { 
                    totalCids: cids.length,
                    successfulVerifications: results.filter(r => r.valid).length 
                });

                return results;
            } catch (error) {
                logger.error('Error in batch verification', { error: error.message });
                throw new Error(`Failed to perform batch verification: ${error.message}`);
            }
        },

        complianceReport: async (_, { nodeId, type }) => {
            try {
                const node = graph.getNode(nodeId);
                if (!node) {
                    throw new Error('Node not found');
                }

                const provenance = graph.getProvenance(nodeId);
                const verificationResults = await graph.verifyProvenance(nodeId, storage);
                
                const findings = [];
                const failedVerifications = verificationResults.filter(r => !r.valid);
                
                if (failedVerifications.length > 0) {
                    findings.push(`${failedVerifications.length} verification failures detected in provenance chain`);
                }
                if (provenance.length === 0) {
                    findings.push('No provenance data available');
                }
                if (!node.cid) {
                    findings.push('Node not stored on distributed storage');
                }

                const status = findings.length === 0 ? 'COMPLIANT' : 'NON_COMPLIANT';

                logger.info('Compliance report generated', { 
                    nodeId, 
                    type, 
                    status,
                    findingsCount: findings.length 
                });
                
                return {
                    reportId: `compliance_${nodeId}_${Date.now()}`,
                    nodeId: nodeId,
                    complianceType: type,
                    status: status,
                    findings: findings,
                    generatedAt: new Date().toISOString(),
                    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
                };
            } catch (error) {
                logger.error('Error generating compliance report', { nodeId, type, error: error.message });
                throw new Error(`Failed to generate compliance report: ${error.message}`);
            }
        },

        auditTrail: async (_, { nodeId, fromDate, toDate }) => {
            try {
                const provenance = graph.getProvenance(nodeId);
                let auditNodes = [];
                
                for (const path of provenance) {
                    for (const step of path) {
                        if (step.node) {
                            auditNodes.push(step.node);
                        }
                    }
                }
                
                // Remove duplicates
                const uniqueNodes = Array.from(new Map(auditNodes.map(n => [n.id, n])).values());
                
                // Filter by date range if provided
                if (fromDate || toDate) {
                    const filteredNodes = uniqueNodes.filter(node => {
                        const nodeDate = new Date(node.createdAt);
                        if (fromDate && nodeDate < fromDate) return false;
                        if (toDate && nodeDate > toDate) return false;
                        return true;
                    });
                    auditNodes = filteredNodes;
                } else {
                    auditNodes = uniqueNodes;
                }

                logger.info('Audit trail generated', { 
                    nodeId, 
                    totalNodesInTrail: auditNodes.length,
                    dateFiltered: !!(fromDate || toDate)
                });
                
                return auditNodes.map(node => ({ 
                    ...node.toJSON(), 
                    verified: node.getVerificationStatus().verified
                }));
            } catch (error) {
                logger.error('Error generating audit trail', { nodeId, error: error.message });
                throw new Error(`Failed to generate audit trail: ${error.message}`);
            }
        },

        graphStats: async () => {
            try {
                const metrics = graph.getGraphMetrics();
                const storageMetrics = await storage.getStorageMetrics();

                logger.info('Graph statistics retrieved', { 
                    totalNodes: metrics.totalNodes,
                    verifiedNodes: metrics.verifiedNodes 
                });

                return {
                    nodeCount: metrics.totalNodes,
                    edgeCount: metrics.totalEdges,
                    verifiedNodes: metrics.verifiedNodes,
                    totalDataSize: metrics.totalStorage,
                    averageVerificationTime: storageMetrics.averageVerificationTime || 0
                };
            } catch (error) {
                logger.error('Error retrieving graph stats', { error: error.message });
                throw new Error(`Failed to retrieve graph statistics: ${error.message}`);
            }
        },

        verificationStats: async (_, { timeRange }) => {
            try {
                const storageMetrics = await storage.getStorageMetrics();

                logger.info('Verification statistics retrieved', { timeRange });

                return {
                    totalVerifications: storageMetrics.totalVerifications || 0,
                    successfulVerifications: storageMetrics.successfulVerifications || 0,
                    failedVerifications: storageMetrics.failedVerifications || 0,
                    averageTime: storageMetrics.averageVerificationTime || 0,
                    timeRange: timeRange
                };
            } catch (error) {
                logger.error('Error retrieving verification stats', { error: error.message });
                throw new Error(`Failed to retrieve verification statistics: ${error.message}`);
            }
        }
    },

    Mutation: {
        createNode: async (_, { input }) => {
            try {
                const node = new ProvenanceNode(input.data, input.metadata);
                
                if (input.linkToFilecoin) {
                    try {
                        const storageResult = await storage.store(input.data);
                        await node.linkToFilecoin(storageResult.cid, storageResult.proof);
                        
                        logger.info('Node created and stored', { 
                            nodeId: node.id,
                            cid: storageResult.cid 
                        });
                    } catch (storageError) {
                        logger.warn('Node created but storage failed', { 
                            nodeId: node.id, 
                            error: storageError.message 
                        });
                    }
                } else {
                    logger.info('Node created without storage', { nodeId: node.id });
                }
                
                graph.addNode(node);
                
                return {
                    ...node.toJSON(),
                    verified: node.getVerificationStatus().verified
                };
            } catch (error) {
                logger.error('Error creating node', { error: error.message });
                throw new Error(`Failed to create node: ${error.message}`);
            }
        },

        storeData: async (_, { data, metadata }) => {
            try {
                const node = new ProvenanceNode(data, metadata);
                
                const storageResult = await storage.store(data);
                await node.linkToFilecoin(storageResult.cid, storageResult.proof);
                
                graph.addNode(node);

                logger.info('Data stored and node created', { 
                    nodeId: node.id,
                    cid: storageResult.cid 
                });
                
                return {
                    ...node.toJSON(),
                    verified: true
                };
            } catch (error) {
                logger.error('Error storing data', { error: error.message });
                throw new Error(`Failed to store data: ${error.message}`);
            }
        },

        createEdge: async (_, { input }) => {
            try {
                const edge = new ProvenanceEdge(
                    input.sourceId,
                    input.targetId,
                    input.relationshipType,
                    input.transformationProof
                );
                
                graph.addEdge(edge);

                logger.info('Edge created', { 
                    edgeId: edge.id,
                    relationship: input.relationshipType 
                });
                
                return edge.toJSON();
            } catch (error) {
                logger.error('Error creating edge', { error: error.message });
                throw new Error(`Failed to create edge: ${error.message}`);
            }
        },

        generatePDPProof: async (_, { nodeId }) => {
            try {
                const node = graph.getNode(nodeId);
                if (!node || !node.cid) {
                    throw new Error('Node not found or not linked to Filecoin');
                }
                
                // Regenerate storage proof
                const storageResult = await storage.store(node.data);
                await node.linkToFilecoin(node.cid, storageResult.proof);

                logger.info('PDP proof generated', { nodeId, cid: node.cid });
                
                return node.storageProof;
            } catch (error) {
                logger.error('Error generating PDP proof', { nodeId, error: error.message });
                throw new Error(`Failed to generate PDP proof: ${error.message}`);
            }
        },

        refreshVerification: async (_, { nodeId }) => {
            try {
                const node = graph.getNode(nodeId);
                if (!node || !node.cid) {
                    throw new Error('Node not found or not linked to Filecoin');
                }
                
                await node.verify(storage);

                logger.info('Verification refreshed', { nodeId, cid: node.cid });
                
                return {
                    valid: true,
                    cid: node.cid,
                    verifiedAt: new Date().toISOString(),
                    source: 'refresh_operation',
                    error: null
                };
            } catch (error) {
                logger.error('Error refreshing verification', { nodeId, error: error.message });
                return {
                    valid: false,
                    cid: node?.cid,
                    verifiedAt: new Date().toISOString(),
                    source: 'refresh_operation',
                    error: error.message
                };
            }
        }
    }
};

module.exports = {
    typeDefs,
    resolvers,
    CIDScalar
};
