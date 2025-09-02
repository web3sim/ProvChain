/**
 * ProvChain Test Suite
 * 
 * Comprehensive tests for the core functionality
 */

const { ProvChainGraph, ProvenanceNode, ProvenanceEdge } = require('../src/provchain-core');
const { FilecoinStorage } = require('../src/filecoin-storage');

describe('ProvChain Core Tests', () => {
    let graph;
    let storage;

    beforeEach(() => {
        graph = new ProvChainGraph();
        storage = new FilecoinStorage({ token: 'test-token' });
    });

    describe('ProvenanceNode', () => {
        test('should create a node with unique ID', () => {
            const node1 = new ProvenanceNode('test data 1', { type: 'test' });
            const node2 = new ProvenanceNode('test data 2', { type: 'test' });
            
            expect(node1.id).toBeDefined();
            expect(node2.id).toBeDefined();
            expect(node1.id).not.toBe(node2.id);
        });

        test('should link to Filecoin storage', async () => {
            const node = new ProvenanceNode('test data', { type: 'test' });
            const cid = 'bafk2bzaced1234567890';
            const pdpProof = { algorithm: 'test', proof: 'abc123' };
            
            await node.linkToFilecoin(cid, pdpProof);
            
            expect(node.cid).toBe(cid);
            expect(node.pdpProof).toBe(pdpProof);
            expect(node.updatedAt).toBeDefined();
        });

        test('should verify with PDP proof', () => {
            const node = new ProvenanceNode('test data', { type: 'test' });
            
            // Should throw without CID/proof
            expect(() => node.verify()).toThrow('Node not linked to Filecoin storage');
            
            // Should verify with CID/proof
            node.cid = 'bafk2bzaced1234567890';
            node.pdpProof = { algorithm: 'test', proof: 'abc123' };
            expect(node.verify()).toBe(true);
        });
    });

    describe('ProvChainGraph', () => {
        test('should add nodes and maintain indices', () => {
            const node1 = new ProvenanceNode('data1', { type: 'dataset' });
            const node2 = new ProvenanceNode('data2', { type: 'model' });
            
            graph.addNode(node1);
            graph.addNode(node2);
            
            expect(graph.nodes.size).toBe(2);
            expect(graph.getNode(node1.id)).toBe(node1);
            expect(graph.getNodesByType('dataset')).toHaveLength(1);
            expect(graph.getNodesByType('model')).toHaveLength(1);
        });

        test('should add edges between existing nodes', () => {
            const node1 = new ProvenanceNode('source', { type: 'dataset' });
            const node2 = new ProvenanceNode('target', { type: 'model' });
            
            graph.addNode(node1);
            graph.addNode(node2);
            
            const edge = new ProvenanceEdge(node1.id, node2.id, 'training');
            graph.addEdge(edge);
            
            expect(graph.edges.size).toBe(1);
            
            const neighbors = graph.getNeighbors(node1.id, 'outgoing');
            expect(neighbors).toHaveLength(1);
            expect(neighbors[0].node.id).toBe(node2.id);
        });

        test('should track provenance paths', () => {
            // Create a simple chain: dataset -> cleaned -> model
            const dataset = new ProvenanceNode('raw data', { type: 'dataset' });
            const cleaned = new ProvenanceNode('cleaned data', { type: 'processed' });
            const model = new ProvenanceNode('trained model', { type: 'model' });
            
            graph.addNode(dataset);
            graph.addNode(cleaned);
            graph.addNode(model);
            
            const edge1 = new ProvenanceEdge(dataset.id, cleaned.id, 'cleaning');
            const edge2 = new ProvenanceEdge(cleaned.id, model.id, 'training');
            
            graph.addEdge(edge1);
            graph.addEdge(edge2);
            
            const provenance = graph.getProvenance(model.id);
            expect(provenance).toHaveLength(1);
            expect(provenance[0]).toHaveLength(3); // dataset -> cleaned -> model
        });

        test('should query nodes with filters', () => {
            const node1 = new ProvenanceNode('data1', { type: 'dataset' });
            const node2 = new ProvenanceNode('data2', { type: 'model' });
            const node3 = new ProvenanceNode('data3', { type: 'dataset' });
            
            graph.addNode(node1);
            graph.addNode(node2);
            graph.addNode(node3);
            
            const results = graph.query({ nodeType: 'dataset', limit: 5 });
            expect(results).toHaveLength(2);
            expect(results.every(r => r.metadata.type === 'dataset')).toBe(true);
        });
    });

    describe('FilecoinStorage', () => {
        test('should store and retrieve data', async () => {
            const testData = 'test data for storage';
            const metadata = { type: 'test', size: testData.length };
            
            const storeResult = await storage.store(testData, metadata);
            expect(storeResult.cid).toBeDefined();
            expect(storeResult.pdpProof).toBeDefined();
            
            const retrieveResult = await storage.retrieve(storeResult.cid, false);
            expect(retrieveResult.data).toBeDefined();
            expect(retrieveResult.source).toBeDefined();
        });

        test('should generate and verify PDP proofs', async () => {
            const testData = 'test data for proof';
            const cid = 'bafk2bzacedtestcid123456';
            
            const proof = await storage.generatePDPProof(testData, cid);
            expect(proof.algorithm).toBeDefined();
            expect(proof.proof).toBeDefined();
            expect(proof.cid).toBe(cid);
            
            // Store the proof for verification
            storage.pdpProofs.set(cid, proof);
            
            const isValid = await storage.verifyPDPProof(cid, testData);
            expect(isValid).toBe(true);
        });

        test('should handle batch operations', async () => {
            const items = [
                { data: 'item1', metadata: { type: 'test' } },
                { data: 'item2', metadata: { type: 'test' } },
                { data: 'item3', metadata: { type: 'test' } }
            ];
            
            const results = await storage.batchStore(items);
            expect(results).toHaveLength(3);
            expect(results.every(r => r.success)).toBe(true);
            
            const cids = results.map(r => r.cid);
            const retrieveResults = await storage.batchRetrieve(cids, false);
            expect(retrieveResults).toHaveLength(3);
            expect(retrieveResults.every(r => r.success)).toBe(true);
        });

        test('should maintain cache statistics', () => {
            const stats = storage.getCacheStats();
            expect(stats.cacheSize).toBe(0);
            expect(stats.proofsStored).toBe(0);
            expect(stats.cacheThreshold).toBeDefined();
            expect(Array.isArray(stats.cachedCids)).toBe(true);
        });
    });

    describe('Integration Tests', () => {
        test('should create complete provenance chain with storage', async () => {
            // Create nodes
            const dataset = new ProvenanceNode('financial data Q3', { type: 'dataset' });
            const processed = new ProvenanceNode('cleaned financial data', { type: 'processed' });
            const model = new ProvenanceNode('risk model v1.0', { type: 'model' });
            
            // Store in Filecoin
            const store1 = await storage.store(dataset.data, dataset.metadata);
            await dataset.linkToFilecoin(store1.cid, store1.pdpProof);
            
            const store2 = await storage.store(processed.data, processed.metadata);
            await processed.linkToFilecoin(store2.cid, store2.pdpProof);
            
            const store3 = await storage.store(model.data, model.metadata);
            await model.linkToFilecoin(store3.cid, store3.pdpProof);
            
            // Add to graph
            graph.addNode(dataset);
            graph.addNode(processed);
            graph.addNode(model);
            
            // Create relationships
            const edge1 = new ProvenanceEdge(dataset.id, processed.id, 'data_cleaning');
            const edge2 = new ProvenanceEdge(processed.id, model.id, 'model_training');
            
            graph.addEdge(edge1);
            graph.addEdge(edge2);
            
            // Verify complete provenance
            const provenance = graph.getProvenance(model.id);
            expect(provenance).toHaveLength(1);
            expect(provenance[0]).toHaveLength(3);
            
            // Verify all nodes
            const verification = graph.verifyProvenance(model.id);
            expect(verification).toHaveLength(1);
            expect(verification[0].valid).toBe(true);
            
            // Test retrieval by CID
            const retrievedNode = graph.getNodeByCid(store2.cid);
            expect(retrievedNode.id).toBe(processed.id);
        });

        test('should handle query with verification', async () => {
            const node = new ProvenanceNode('test data', { type: 'test' });
            const storeResult = await storage.store(node.data, node.metadata);
            await node.linkToFilecoin(storeResult.cid, storeResult.pdpProof);
            
            graph.addNode(node);
            
            const results = graph.query({ nodeType: 'test' });
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(node.id);
            expect(results[0].verified).toBe(true);
        });
    });
});

// Test helper functions
function createTestGraph() {
    const graph = new ProvChainGraph();
    const storage = new FilecoinStorage({ token: 'test' });
    
    return { graph, storage };
}

async function createTestProvenance(graph, storage) {
    const nodes = [];
    const edges = [];
    
    // Create test data chain
    for (let i = 0; i < 3; i++) {
        const node = new ProvenanceNode(`test data ${i}`, { type: 'test', step: i });
        const storeResult = await storage.store(node.data, node.metadata);
        await node.linkToFilecoin(storeResult.cid, storeResult.pdpProof);
        
        graph.addNode(node);
        nodes.push(node);
        
        if (i > 0) {
            const edge = new ProvenanceEdge(nodes[i-1].id, node.id, 'transformation');
            graph.addEdge(edge);
            edges.push(edge);
        }
    }
    
    return { nodes, edges };
}

module.exports = {
    createTestGraph,
    createTestProvenance
};
