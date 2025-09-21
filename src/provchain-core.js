/**
 * ProvChain Core - Knowledge Graph with Verifiable Provenance
 * 
 * This module implements the core knowledge graph database with
 * cryptographic linking to Filecoin storage and comprehensive verification.
 */

const crypto = require('crypto');
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

class ProvenanceNode {
    constructor(data, metadata = {}) {
        this.id = this.generateNodeId();
        this.data = data;
        this.metadata = {
            ...metadata,
            nodeType: metadata.type || 'data',
            dataSize: this.calculateDataSize(data),
            createdBy: metadata.createdBy || 'system'
        };
        this.cid = null;
        this.storageProof = null;
        this.verificationHistory = [];
        this.createdAt = new Date().toISOString();
        this.updatedAt = this.createdAt;
        this.version = 1;
        this.tags = metadata.tags || [];
    }

    generateNodeId() {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify({
            data: this.data,
            timestamp: Date.now(),
            random: Math.random().toString(36)
        }));
        return `node_${hash.digest('hex').substring(0, 16)}`;
    }

    calculateDataSize(data) {
        return Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
    }

    async linkToFilecoin(cid, storageProof) {
        this.cid = cid;
        this.storageProof = storageProof;
        this.updatedAt = new Date().toISOString();
        
        // Record initial verification
        this.verificationHistory.push({
            timestamp: new Date().toISOString(),
            action: 'storage_linked',
            cid: cid,
            verified: true,
            deals: storageProof.deals?.length || 0
        });

        logger.info('Node linked to Filecoin storage', { 
            nodeId: this.id, 
            cid: cid, 
            deals: storageProof.deals?.length || 0 
        });

        return this;
    }

    async verify(storage) {
        if (!this.cid || !this.storageProof) {
            throw new Error('Node not linked to Filecoin storage');
        }

        try {
            // Verify storage proof
            const isValid = await storage.verifyStorageProof(this.cid, this.data);
            
            // Record verification result
            this.verificationHistory.push({
                timestamp: new Date().toISOString(),
                action: 'integrity_check',
                cid: this.cid,
                verified: isValid,
                verificationMethod: 'storage_proof'
            });

            if (!isValid) {
                logger.warn('Node verification failed', { nodeId: this.id, cid: this.cid });
                throw new Error('Storage proof verification failed');
            }

            logger.info('Node verification successful', { nodeId: this.id, cid: this.cid });
            return true;

        } catch (error) {
            logger.error('Node verification error', { 
                nodeId: this.id, 
                cid: this.cid, 
                error: error.message 
            });
            throw error;
        }
    }

    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
            this.updatedAt = new Date().toISOString();
        }
    }

    removeTag(tag) {
        const index = this.tags.indexOf(tag);
        if (index > -1) {
            this.tags.splice(index, 1);
            this.updatedAt = new Date().toISOString();
        }
    }

    getVerificationStatus() {
        const lastVerification = this.verificationHistory[this.verificationHistory.length - 1];
        return {
            lastVerified: lastVerification?.timestamp,
            verified: lastVerification?.verified || false,
            totalVerifications: this.verificationHistory.length,
            linkedToStorage: !!this.cid
        };
    }

    toJSON() {
        return {
            id: this.id,
            data: this.data,
            metadata: this.metadata,
            cid: this.cid,
            storageProof: this.storageProof,
            verificationHistory: this.verificationHistory,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            version: this.version,
            tags: this.tags
        };
    }
}

class ProvenanceEdge {
    constructor(sourceId, targetId, relationshipType, transformationProof = null) {
        this.id = this.generateEdgeId(sourceId, targetId, relationshipType);
        this.sourceId = sourceId;
        this.targetId = targetId;
        this.relationshipType = relationshipType;
        this.transformationProof = transformationProof;
        this.metadata = {};
        this.createdAt = new Date().toISOString();
        this.weight = 1.0;
        this.verified = false;
    }

    generateEdgeId(sourceId, targetId, relationshipType) {
        const hash = crypto.createHash('sha256');
        hash.update(`${sourceId}-${targetId}-${relationshipType}-${Date.now()}`);
        return `edge_${hash.digest('hex').substring(0, 16)}`;
    }

    setTransformationDetails(details) {
        this.metadata.transformation = {
            method: details.method,
            parameters: details.parameters,
            timestamp: new Date().toISOString(),
            operator: details.operator || 'system'
        };
        
        // Generate transformation proof
        if (details.inputData && details.outputData) {
            this.transformationProof = this.generateTransformationProof(details);
        }
    }

    generateTransformationProof(details) {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify({
            inputHash: crypto.createHash('sha256').update(details.inputData).digest('hex'),
            outputHash: crypto.createHash('sha256').update(details.outputData).digest('hex'),
            method: details.method,
            parameters: details.parameters,
            timestamp: details.timestamp
        }));

        return {
            algorithm: 'sha256_transformation',
            proof: hash.digest('hex'),
            inputHash: crypto.createHash('sha256').update(details.inputData).digest('hex'),
            outputHash: crypto.createHash('sha256').update(details.outputData).digest('hex'),
            generatedAt: new Date().toISOString()
        };
    }

    verify(sourceNode, targetNode) {
        try {
            // Verify that source and target nodes exist and are valid
            if (!sourceNode || !targetNode) {
                throw new Error('Source or target node missing for verification');
            }

            // Verify transformation proof if present
            if (this.transformationProof && this.metadata.transformation) {
                const expectedInputHash = crypto.createHash('sha256')
                    .update(sourceNode.data).digest('hex');
                const expectedOutputHash = crypto.createHash('sha256')
                    .update(targetNode.data).digest('hex');

                if (this.transformationProof.inputHash !== expectedInputHash ||
                    this.transformationProof.outputHash !== expectedOutputHash) {
                    throw new Error('Transformation proof verification failed');
                }
            }

            this.verified = true;
            logger.info('Edge verification successful', { 
                edgeId: this.id, 
                relationship: this.relationshipType 
            });
            
            return true;

        } catch (error) {
            logger.error('Edge verification failed', { 
                edgeId: this.id, 
                error: error.message 
            });
            this.verified = false;
            throw error;
        }
    }

    toJSON() {
        return {
            id: this.id,
            sourceId: this.sourceId,
            targetId: this.targetId,
            relationshipType: this.relationshipType,
            transformationProof: this.transformationProof,
            metadata: this.metadata,
            createdAt: this.createdAt,
            weight: this.weight,
            verified: this.verified
        };
    }
}

class ProvChainGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map();
        this.indices = {
            byCid: new Map(),
            byType: new Map(),
            byTimestamp: new Map(),
            byTags: new Map()
        };
        this.metrics = {
            totalNodes: 0,
            totalEdges: 0,
            verifiedNodes: 0,
            totalStorage: 0
        };
    }

    addNode(node) {
        if (!(node instanceof ProvenanceNode)) {
            throw new Error('Invalid node type');
        }
        
        this.nodes.set(node.id, node);
        this.updateMetrics();
        
        // Update indices
        if (node.cid) {
            this.indices.byCid.set(node.cid, node.id);
        }
        
        const nodeType = node.metadata.nodeType || 'unknown';
        if (!this.indices.byType.has(nodeType)) {
            this.indices.byType.set(nodeType, new Set());
        }
        this.indices.byType.get(nodeType).add(node.id);
        
        // Index by tags
        node.tags.forEach(tag => {
            if (!this.indices.byTags.has(tag)) {
                this.indices.byTags.set(tag, new Set());
            }
            this.indices.byTags.get(tag).add(node.id);
        });
        
        // Index by timestamp (for time-based queries)
        const dateKey = node.createdAt.split('T')[0]; // YYYY-MM-DD
        if (!this.indices.byTimestamp.has(dateKey)) {
            this.indices.byTimestamp.set(dateKey, new Set());
        }
        this.indices.byTimestamp.get(dateKey).add(node.id);

        logger.info('Node added to graph', { 
            nodeId: node.id, 
            type: nodeType, 
            hasStorage: !!node.cid 
        });
        
        return node.id;
    }

    addEdge(edge) {
        if (!(edge instanceof ProvenanceEdge)) {
            throw new Error('Invalid edge type');
        }
        
        // Verify source and target nodes exist
        if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
            throw new Error('Source or target node does not exist');
        }
        
        this.edges.set(edge.id, edge);
        this.updateMetrics();

        logger.info('Edge added to graph', { 
            edgeId: edge.id, 
            relationship: edge.relationshipType 
        });
        
        return edge.id;
    }

    updateMetrics() {
        this.metrics.totalNodes = this.nodes.size;
        this.metrics.totalEdges = this.edges.size;
        this.metrics.verifiedNodes = Array.from(this.nodes.values())
            .filter(node => node.cid).length;
        this.metrics.totalStorage = Array.from(this.nodes.values())
            .reduce((sum, node) => sum + node.metadata.dataSize, 0);
    }

    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    getNodeByCid(cid) {
        const nodeId = this.indices.byCid.get(cid);
        return nodeId ? this.nodes.get(nodeId) : null;
    }

    getNodesByType(type) {
        const nodeIds = this.indices.byType.get(type) || new Set();
        return Array.from(nodeIds).map(id => this.nodes.get(id));
    }

    getNodesByTag(tag) {
        const nodeIds = this.indices.byTags.get(tag) || new Set();
        return Array.from(nodeIds).map(id => this.nodes.get(id));
    }

    getNodesByDateRange(startDate, endDate) {
        const results = [];
        for (const [dateKey, nodeIds] of this.indices.byTimestamp.entries()) {
            if (dateKey >= startDate && dateKey <= endDate) {
                nodeIds.forEach(id => {
                    const node = this.nodes.get(id);
                    if (node) results.push(node);
                });
            }
        }
        return results;
    }

    getNeighbors(nodeId, direction = 'both') {
        const neighbors = [];
        
        for (const edge of this.edges.values()) {
            if (direction === 'outgoing' || direction === 'both') {
                if (edge.sourceId === nodeId) {
                    neighbors.push({
                        node: this.nodes.get(edge.targetId),
                        edge: edge,
                        direction: 'outgoing'
                    });
                }
            }
            
            if (direction === 'incoming' || direction === 'both') {
                if (edge.targetId === nodeId) {
                    neighbors.push({
                        node: this.nodes.get(edge.sourceId),
                        edge: edge,
                        direction: 'incoming'
                    });
                }
            }
        }
        
        return neighbors;
    }

    getProvenance(nodeId, maxDepth = 10) {
        const provenance = [];
        const visited = new Set();
        
        const traverse = (currentNodeId, path = [], depth = 0) => {
            if (visited.has(currentNodeId) || depth > maxDepth) {
                return;
            }
            
            visited.add(currentNodeId);
            const currentNode = this.nodes.get(currentNodeId);
            
            if (!currentNode) {
                return;
            }
            
            const incomingEdges = this.getNeighbors(currentNodeId, 'incoming');
            
            if (incomingEdges.length === 0) {
                // This is a source node, record the complete path
                provenance.push([...path, {
                    node: currentNode,
                    edge: null,
                    depth: depth
                }]);
            } else {
                // Continue traversing
                for (const neighbor of incomingEdges) {
                    traverse(neighbor.node.id, [...path, {
                        node: currentNode,
                        edge: neighbor.edge,
                        depth: depth
                    }], depth + 1);
                }
            }
        };
        
        traverse(nodeId);
        
        logger.info('Provenance traced', { 
            nodeId, 
            pathsFound: provenance.length,
            maxDepthReached: Math.max(...provenance.flat().map(p => p.depth || 0))
        });
        
        return provenance;
    }

    async verifyProvenance(nodeId, storage) {
        const provenance = this.getProvenance(nodeId);
        const verificationResults = [];
        
        for (const path of provenance) {
            const pathResult = {
                path: path,
                valid: true,
                errors: [],
                verifiedAt: new Date().toISOString()
            };
            
            for (const step of path) {
                try {
                    if (step.node && step.node.cid) {
                        await step.node.verify(storage);
                    }
                    if (step.edge) {
                        const sourceNode = this.nodes.get(step.edge.sourceId);
                        const targetNode = this.nodes.get(step.edge.targetId);
                        step.edge.verify(sourceNode, targetNode);
                    }
                } catch (error) {
                    pathResult.valid = false;
                    pathResult.errors.push({
                        nodeId: step.node?.id,
                        edgeId: step.edge?.id,
                        error: error.message
                    });
                }
            }
            
            verificationResults.push(pathResult);
        }

        const totalPaths = verificationResults.length;
        const validPaths = verificationResults.filter(r => r.valid).length;
        
        logger.info('Provenance verification completed', { 
            nodeId, 
            totalPaths, 
            validPaths,
            verificationRate: validPaths / totalPaths
        });
        
        return verificationResults;
    }

    query(query) {
        const { 
            nodeType, 
            cid, 
            tags,
            dateRange,
            verified,
            limit = 10,
            offset = 0,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = query;
        
        let results = [];
        
        if (cid) {
            const node = this.getNodeByCid(cid);
            if (node) {
                results = [node];
            }
        } else if (nodeType) {
            results = this.getNodesByType(nodeType);
        } else if (tags && tags.length > 0) {
            // Find nodes with any of the specified tags
            const nodeSet = new Set();
            tags.forEach(tag => {
                this.getNodesByTag(tag).forEach(node => nodeSet.add(node));
            });
            results = Array.from(nodeSet);
        } else if (dateRange) {
            results = this.getNodesByDateRange(dateRange.start, dateRange.end);
        } else {
            results = Array.from(this.nodes.values());
        }
        
        // Apply verified filter
        if (typeof verified === 'boolean') {
            results = results.filter(node => !!node.cid === verified);
        }
        
        // Sort results
        results.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            if (sortOrder === 'desc') {
                return bVal > aVal ? 1 : -1;
            } else {
                return aVal > bVal ? 1 : -1;
            }
        });
        
        // Apply pagination
        const paginatedResults = results.slice(offset, offset + limit);
        
        logger.info('Query executed', { 
            resultsFound: results.length,
            returned: paginatedResults.length,
            filters: Object.keys(query).filter(k => query[k] !== undefined)
        });
        
        return paginatedResults.map(node => ({
            ...node.toJSON(),
            verified: !!node.cid
        }));
    }

    getGraphMetrics() {
        const nodeTypes = {};
        const tagDistribution = {};
        
        for (const node of this.nodes.values()) {
            const type = node.metadata.nodeType;
            nodeTypes[type] = (nodeTypes[type] || 0) + 1;
            
            node.tags.forEach(tag => {
                tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
            });
        }
        
        return {
            ...this.metrics,
            nodeTypes,
            tagDistribution,
            averageNodeSize: this.metrics.totalStorage / this.metrics.totalNodes || 0,
            verificationRate: this.metrics.verifiedNodes / this.metrics.totalNodes || 0
        };
    }

    exportGraph() {
        return {
            nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
            edges: Array.from(this.edges.values()).map(e => e.toJSON()),
            metadata: {
                ...this.getGraphMetrics(),
                exportedAt: new Date().toISOString(),
                version: "1.0"
            }
        };
    }

    importGraph(graphData) {
        // Clear existing data
        this.nodes.clear();
        this.edges.clear();
        this.indices = {
            byCid: new Map(),
            byType: new Map(),
            byTimestamp: new Map(),
            byTags: new Map()
        };
        
        // Import nodes
        for (const nodeData of graphData.nodes) {
            const node = new ProvenanceNode(nodeData.data, nodeData.metadata);
            Object.assign(node, nodeData); // Restore all properties
            this.addNode(node);
        }
        
        // Import edges
        for (const edgeData of graphData.edges) {
            const edge = new ProvenanceEdge(
                edgeData.sourceId,
                edgeData.targetId,
                edgeData.relationshipType,
                edgeData.transformationProof
            );
            Object.assign(edge, edgeData); // Restore all properties
            this.addEdge(edge);
        }

        logger.info('Graph imported', { 
            nodes: this.nodes.size,
            edges: this.edges.size
        });
    }
}

module.exports = {
    ProvenanceNode,
    ProvenanceEdge,
    ProvChainGraph
};
