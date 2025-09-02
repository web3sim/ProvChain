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
        node: async (_, { id }, { dataSources }) => {
            const node = dataSources.graph.getNode(id);
            if (!node) return null;
            
            const verification = await dataSources.storage.verifyIntegrity(node.cid);
            return {
                ...node.toJSON(),
                verified: verification.valid
            };
        },

        nodes: async (_, { filter, limit, cursor }, { dataSources }) => {
            const query = {
                nodeType: filter?.nodeType,
                limit: Math.min(limit, 100) // Cap at 100
            };
            
            const results = dataSources.graph.query(query);
            
            return {
                nodes: results,
                totalCount: results.length,
                hasNextPage: results.length === limit,
                cursor: results.length > 0 ? results[results.length - 1].id : null
            };
        },

        nodesByCid: async (_, { cids }, { dataSources }) => {
            const nodes = [];
            for (const cid of cids) {
                const node = dataSources.graph.getNodeByCid(cid);
                if (node) {
                    const verification = await dataSources.storage.verifyIntegrity(cid);
                    nodes.push({
                        ...node.toJSON(),
                        verified: verification.valid
                    });
                }
            }
            return nodes;
        },

        provenance: async (_, { query }, { dataSources }) => {
            const provenance = dataSources.graph.getProvenance(query.nodeId);
            const paths = [];
            
            for (const path of provenance) {
                const nodes = path.map(step => step.node).filter(Boolean);
                const edges = path.map(step => step.edge).filter(Boolean);
                
                // Verify each path
                let valid = true;
                for (const node of nodes) {
                    if (node.cid) {
                        const verification = await dataSources.storage.verifyIntegrity(node.cid);
                        if (!verification.valid) {
                            valid = false;
                            break;
                        }
                    }
                }
                
                paths.push({
                    nodes: nodes.map(n => ({ ...n.toJSON(), verified: valid })),
                    edges: edges.map(e => e.toJSON()),
                    valid: valid,
                    verifiedAt: new Date().toISOString()
                });
            }
            
            return paths;
        },

        verifyProvenance: async (_, { nodeId }, { dataSources }) => {
            const results = dataSources.graph.verifyProvenance(nodeId);
            const verificationResults = [];
            
            for (const result of results) {
                for (const step of result.path) {
                    if (step.node && step.node.cid) {
                        const verification = await dataSources.storage.verifyIntegrity(step.node.cid);
                        verificationResults.push(verification);
                    }
                }
            }
            
            return verificationResults;
        },

        verifyIntegrity: async (_, { cid }, { dataSources }) => {
            return await dataSources.storage.verifyIntegrity(cid);
        },

        batchVerify: async (_, { cids }, { dataSources }) => {
            const results = [];
            for (const cid of cids) {
                const result = await dataSources.storage.verifyIntegrity(cid);
                results.push(result);
            }
            return results;
        },

        complianceReport: async (_, { nodeId, type }, { dataSources }) => {
            // Generate compliance report based on provenance
            const provenance = dataSources.graph.getProvenance(nodeId);
            const verification = dataSources.graph.verifyProvenance(nodeId);
            
            const findings = [];
            if (verification.some(r => !r.valid)) {
                findings.push('Verification failures detected in provenance chain');
            }
            if (provenance.length === 0) {
                findings.push('No provenance data available');
            }
            
            return {
                reportId: `compliance_${nodeId}_${Date.now()}`,
                nodeId: nodeId,
                complianceType: type,
                status: findings.length === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
                findings: findings,
                generatedAt: new Date().toISOString(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
            };
        },

        auditTrail: async (_, { nodeId, fromDate, toDate }, { dataSources }) => {
            const provenance = dataSources.graph.getProvenance(nodeId);
            let auditNodes = [];
            
            for (const path of provenance) {
                for (const step of path) {
                    if (step.node) {
                        auditNodes.push(step.node);
                    }
                }
            }
            
            // Filter by date range if provided
            if (fromDate || toDate) {
                auditNodes = auditNodes.filter(node => {
                    const nodeDate = new Date(node.createdAt);
                    if (fromDate && nodeDate < fromDate) return false;
                    if (toDate && nodeDate > toDate) return false;
                    return true;
                });
            }
            
            return auditNodes.map(node => ({ 
                ...node.toJSON(), 
                verified: true // Simplified for demo
            }));
        },

        graphStats: async (_, __, { dataSources }) => {
            const graph = dataSources.graph.exportGraph();
            return {
                nodeCount: graph.nodes.length,
                edgeCount: graph.edges.length,
                verifiedNodes: graph.nodes.filter(n => n.cid).length,
                totalDataSize: graph.nodes.reduce((sum, n) => sum + (n.metadata?.size || 0), 0),
                averageVerificationTime: 150 // Mock value in ms
            };
        },

        verificationStats: async (_, { timeRange }, { dataSources }) => {
            // Mock verification statistics
            return {
                totalVerifications: 1250,
                successfulVerifications: 1200,
                failedVerifications: 50,
                averageTime: 145.5,
                timeRange: timeRange
            };
        }
    },

    Mutation: {
        createNode: async (_, { input }, { dataSources }) => {
            const { ProvenanceNode } = require('./provchain-core');
            const node = new ProvenanceNode(input.data, input.metadata);
            
            if (input.linkToFilecoin) {
                const storageResult = await dataSources.storage.store(input.data, input.metadata);
                await node.linkToFilecoin(storageResult.cid, storageResult.pdpProof);
            }
            
            dataSources.graph.addNode(node);
            
            return {
                ...node.toJSON(),
                verified: true
            };
        },

        storeData: async (_, { data, metadata }, { dataSources }) => {
            const { ProvenanceNode } = require('./provchain-core');
            const node = new ProvenanceNode(data, metadata);
            
            const storageResult = await dataSources.storage.store(data, metadata);
            await node.linkToFilecoin(storageResult.cid, storageResult.pdpProof);
            
            dataSources.graph.addNode(node);
            
            return {
                ...node.toJSON(),
                verified: true
            };
        },

        createEdge: async (_, { input }, { dataSources }) => {
            const { ProvenanceEdge } = require('./provchain-core');
            const edge = new ProvenanceEdge(
                input.sourceId,
                input.targetId,
                input.relationshipType,
                input.transformationProof
            );
            
            dataSources.graph.addEdge(edge);
            return edge.toJSON();
        },

        generatePDPProof: async (_, { nodeId }, { dataSources }) => {
            const node = dataSources.graph.getNode(nodeId);
            if (!node || !node.cid) {
                throw new Error('Node not found or not linked to Filecoin');
            }
            
            const pdpProof = await dataSources.storage.generatePDPProof(node.data, node.cid);
            await node.linkToFilecoin(node.cid, pdpProof);
            
            return pdpProof;
        },

        refreshVerification: async (_, { nodeId }, { dataSources }) => {
            const node = dataSources.graph.getNode(nodeId);
            if (!node || !node.cid) {
                throw new Error('Node not found or not linked to Filecoin');
            }
            
            return await dataSources.storage.verifyIntegrity(node.cid);
        }
    }
};

module.exports = {
    typeDefs,
    resolvers,
    CIDScalar
};
