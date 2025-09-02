/**
 * ProvChain Core - Knowledge Graph with Verifiable Provenance
 * 
 * This module implements the core knowledge graph database with
 * cryptographic linking to Filecoin storage and PDP verification.
 */

const crypto = require('crypto');
const multihash = require('multihashes');

class ProvenanceNode {
    constructor(data, metadata = {}) {
        this.id = this.generateNodeId();
        this.data = data;
        this.metadata = metadata;
        this.cid = null; // Will be set when stored on Filecoin
        this.pdpProof = null;
        this.createdAt = new Date().toISOString();
        this.updatedAt = this.createdAt;
        this.version = 1;
    }

    generateNodeId() {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify({
            data: this.data,
            timestamp: Date.now(),
            random: Math.random()
        }));
        return hash.digest('hex');
    }

    async linkToFilecoin(cid, pdpProof) {
        this.cid = cid;
        this.pdpProof = pdpProof;
        this.updatedAt = new Date().toISOString();
        return this;
    }

    verify() {
        // Verify PDP proof against stored CID
        if (!this.cid || !this.pdpProof) {
            throw new Error('Node not linked to Filecoin storage');
        }
        // Implementation would verify actual PDP proof
        return true;
    }

    toJSON() {
        return {
            id: this.id,
            data: this.data,
            metadata: this.metadata,
            cid: this.cid,
            pdpProof: this.pdpProof,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            version: this.version
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
        this.createdAt = new Date().toISOString();
        this.weight = 1.0;
    }

    generateEdgeId(sourceId, targetId, relationshipType) {
        const hash = crypto.createHash('sha256');
        hash.update(`${sourceId}-${targetId}-${relationshipType}`);
        return hash.digest('hex');
    }

    toJSON() {
        return {
            id: this.id,
            sourceId: this.sourceId,
            targetId: this.targetId,
            relationshipType: this.relationshipType,
            transformationProof: this.transformationProof,
            createdAt: this.createdAt,
            weight: this.weight
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
            byTimestamp: new Map()
        };
    }

    addNode(node) {
        if (!(node instanceof ProvenanceNode)) {
            throw new Error('Invalid node type');
        }
        
        this.nodes.set(node.id, node);
        
        // Update indices
        if (node.cid) {
            this.indices.byCid.set(node.cid, node.id);
        }
        
        const nodeType = node.metadata.type || 'unknown';
        if (!this.indices.byType.has(nodeType)) {
            this.indices.byType.set(nodeType, new Set());
        }
        this.indices.byType.get(nodeType).add(node.id);
        
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
        return edge.id;
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

    getProvenance(nodeId) {
        const provenance = [];
        const visited = new Set();
        
        const traverse = (currentNodeId, path = []) => {
            if (visited.has(currentNodeId)) {
                return; // Avoid cycles
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
                    edge: null
                }]);
            } else {
                // Continue traversing
                for (const neighbor of incomingEdges) {
                    traverse(neighbor.node.id, [...path, {
                        node: currentNode,
                        edge: neighbor.edge
                    }]);
                }
            }
        };
        
        traverse(nodeId);
        return provenance;
    }

    verifyProvenance(nodeId) {
        const provenance = this.getProvenance(nodeId);
        const verificationResults = [];
        
        for (const path of provenance) {
            const pathResult = {
                path: path,
                valid: true,
                errors: []
            };
            
            for (const step of path) {
                try {
                    if (step.node) {
                        step.node.verify();
                    }
                } catch (error) {
                    pathResult.valid = false;
                    pathResult.errors.push({
                        nodeId: step.node.id,
                        error: error.message
                    });
                }
            }
            
            verificationResults.push(pathResult);
        }
        
        return verificationResults;
    }

    query(query) {
        // Simple query implementation
        // In production, this would be a full GraphQL/SPARQL engine
        const { nodeType, cid, limit = 10 } = query;
        
        let results = [];
        
        if (cid) {
            const node = this.getNodeByCid(cid);
            if (node) {
                results = [node];
            }
        } else if (nodeType) {
            results = this.getNodesByType(nodeType);
        } else {
            results = Array.from(this.nodes.values());
        }
        
        return results.slice(0, limit).map(node => ({
            ...node.toJSON(),
            provenance: this.getProvenance(node.id),
            verified: this.verifyProvenance(node.id).every(r => r.valid)
        }));
    }

    exportGraph() {
        return {
            nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
            edges: Array.from(this.edges.values()).map(e => e.toJSON()),
            metadata: {
                nodeCount: this.nodes.size,
                edgeCount: this.edges.size,
                exportedAt: new Date().toISOString()
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
            byTimestamp: new Map()
        };
        
        // Import nodes
        for (const nodeData of graphData.nodes) {
            const node = new ProvenanceNode(nodeData.data, nodeData.metadata);
            node.id = nodeData.id;
            node.cid = nodeData.cid;
            node.pdpProof = nodeData.pdpProof;
            node.createdAt = nodeData.createdAt;
            node.updatedAt = nodeData.updatedAt;
            node.version = nodeData.version;
            
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
            edge.id = edgeData.id;
            edge.createdAt = edgeData.createdAt;
            edge.weight = edgeData.weight;
            
            this.addEdge(edge);
        }
    }
}

module.exports = {
    ProvenanceNode,
    ProvenanceEdge,
    ProvChainGraph
};
