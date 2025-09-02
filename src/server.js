/**
 * ProvChain Server
 * 
 * Main server entry point that starts the GraphQL API server
 * with integrated Filecoin storage and provenance graph.
 */

const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { typeDefs, resolvers } = require('./graphql-api');
const { ProvChainGraph } = require('./provchain-core');
const { FilecoinStorage } = require('./filecoin-storage');

class ProvChainServer {
    constructor(config = {}) {
        this.config = {
            port: config.port || 4000,
            filecoinConfig: config.filecoin || {},
            ...config
        };
        
        this.graph = new ProvChainGraph();
        this.storage = new FilecoinStorage(this.config.filecoinConfig);
        this.server = null;
    }

    async initialize() {
        // Initialize the Apollo Server
        this.server = new ApolloServer({
            typeDefs,
            resolvers,
            context: ({ req }) => ({
                dataSources: {
                    graph: this.graph,
                    storage: this.storage
                },
                user: req.headers.authorization ? this.authenticateUser(req.headers.authorization) : null
            })
        });

        console.log('ProvChain server initialized');
    }

    async start() {
        if (!this.server) {
            await this.initialize();
        }

        const { url } = await startStandaloneServer(this.server, {
            listen: { port: this.config.port },
            context: async ({ req }) => ({
                dataSources: {
                    graph: this.graph,
                    storage: this.storage
                },
                user: req.headers.authorization ? this.authenticateUser(req.headers.authorization) : null
            })
        });

        console.log(`🚀 ProvChain server ready at: ${url}`);
        console.log(`📊 GraphQL Playground available at: ${url}`);
        
        return url;
    }

    async stop() {
        if (this.server) {
            await this.server.stop();
            console.log('ProvChain server stopped');
        }
    }

    authenticateUser(authHeader) {
        // Simple authentication (in production, use proper JWT verification)
        const token = authHeader.replace('Bearer ', '');
        if (token === 'demo-token') {
            return { id: 'demo-user', role: 'admin' };
        }
        return null;
    }

    async loadSampleData() {
        console.log('Loading sample data...');
        
        const { ProvenanceNode, ProvenanceEdge } = require('./provchain-core');
        
        // Create sample nodes
        const datasetNode = new ProvenanceNode(
            'Financial dataset Q3 2024',
            { type: 'dataset', source: 'Bloomberg', format: 'CSV' }
        );
        
        const storageResult1 = await this.storage.store(datasetNode.data, datasetNode.metadata);
        await datasetNode.linkToFilecoin(storageResult1.cid, storageResult1.pdpProof);
        this.graph.addNode(datasetNode);
        
        const transformNode = new ProvenanceNode(
            'Cleaned and normalized financial data',
            { type: 'transformation', operation: 'data_cleaning', tool: 'pandas' }
        );
        
        const storageResult2 = await this.storage.store(transformNode.data, transformNode.metadata);
        await transformNode.linkToFilecoin(storageResult2.cid, storageResult2.pdpProof);
        this.graph.addNode(transformNode);
        
        const modelNode = new ProvenanceNode(
            'Trained risk assessment model',
            { type: 'model', algorithm: 'random_forest', accuracy: 0.94 }
        );
        
        const storageResult3 = await this.storage.store(modelNode.data, modelNode.metadata);
        await modelNode.linkToFilecoin(storageResult3.cid, storageResult3.pdpProof);
        this.graph.addNode(modelNode);
        
        // Create relationships
        const edge1 = new ProvenanceEdge(
            datasetNode.id,
            transformNode.id,
            'data_transformation',
            'sha256:abc123...'
        );
        this.graph.addEdge(edge1);
        
        const edge2 = new ProvenanceEdge(
            transformNode.id,
            modelNode.id,
            'model_training',
            'sha256:def456...'
        );
        this.graph.addEdge(edge2);
        
        console.log('Sample data loaded successfully');
        console.log(`- Nodes: ${this.graph.nodes.size}`);
        console.log(`- Edges: ${this.graph.edges.size}`);
        console.log(`- Storage cache: ${this.storage.getCacheStats().cacheSize}`);
    }

    getHealthStatus() {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            graph: {
                nodes: this.graph.nodes.size,
                edges: this.graph.edges.size
            },
            storage: this.storage.getCacheStats(),
            server: {
                port: this.config.port,
                uptime: process.uptime()
            }
        };
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new ProvChainServer({
        port: process.env.PORT || 4000,
        filecoin: {
            endpoint: process.env.FILECOIN_ENDPOINT,
            token: process.env.WEB3_STORAGE_TOKEN
        }
    });

    server.start()
        .then(async (url) => {
            // Load sample data in development
            if (process.env.NODE_ENV !== 'production') {
                await server.loadSampleData();
            }
            
            console.log('ProvChain is ready for requests!');
            console.log('\nTry these example queries:');
            console.log('- Health check: GET /health');
            console.log('- GraphQL playground: Open browser to', url);
            console.log('\nExample GraphQL query:');
            console.log(`
query GetNodes {
  nodes(limit: 5) {
    nodes {
      id
      data
      cid
      verified
      createdAt
    }
    totalCount
  }
}
            `);
        })
        .catch(error => {
            console.error('Failed to start ProvChain server:', error);
            process.exit(1);
        });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down ProvChain server...');
        await server.stop();
        process.exit(0);
    });
}

module.exports = { ProvChainServer };
