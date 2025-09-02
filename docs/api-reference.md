# ProvChain API Reference

## Overview

ProvChain provides a GraphQL API for interacting with the verifiable knowledge graph database. All queries include built-in provenance tracking and verification capabilities.

## Base URL

```
http://localhost:4000/graphql
```

## Authentication

Include an authorization header for authenticated requests:

```
Authorization: Bearer <your-token>
```

## Core Types

### ProvenanceNode

Represents a data entity in the knowledge graph with verifiable provenance.

```graphql
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
```

### ProvenanceEdge

Represents a relationship between nodes with transformation proof.

```graphql
type ProvenanceEdge {
    id: ID!
    sourceId: ID!
    targetId: ID!
    relationshipType: String!
    transformationProof: String
    createdAt: DateTime!
    weight: Float!
}
```

### PDPProof

Cryptographic proof of data possession for Filecoin storage.

```graphql
type PDPProof {
    algorithm: String!
    proof: String!
    generatedAt: DateTime!
    cid: CID!
}
```

## Query Examples

### Get a Single Node

```graphql
query GetNode($id: ID!) {
    node(id: $id) {
        id
        data
        metadata
        cid
        verified
        pdpProof {
            algorithm
            proof
            generatedAt
        }
        createdAt
    }
}
```

Variables:
```json
{
    "id": "node-id-here"
}
```

### Get Multiple Nodes with Filtering

```graphql
query GetNodes($filter: NodeFilter, $limit: Int) {
    nodes(filter: $filter, limit: $limit) {
        nodes {
            id
            data
            metadata
            cid
            verified
            createdAt
        }
        totalCount
        hasNextPage
        cursor
    }
}
```

Variables:
```json
{
    "filter": {
        "nodeType": "dataset",
        "verified": true,
        "createdAfter": "2024-01-01T00:00:00Z"
    },
    "limit": 10
}
```

### Get Node Provenance

```graphql
query GetProvenance($nodeId: ID!) {
    provenance(query: { nodeId: $nodeId, maxDepth: 5 }) {
        nodes {
            id
            data
            metadata
            createdAt
        }
        edges {
            id
            relationshipType
            transformationProof
        }
        valid
        verifiedAt
    }
}
```

### Verify Data Integrity

```graphql
query VerifyIntegrity($cid: CID!) {
    verifyIntegrity(cid: $cid) {
        valid
        cid
        verifiedAt
        source
        error
    }
}
```

### Generate Compliance Report

```graphql
query ComplianceReport($nodeId: ID!, $type: String!) {
    complianceReport(nodeId: $nodeId, type: $type) {
        reportId
        nodeId
        complianceType
        status
        findings
        generatedAt
        validUntil
    }
}
```

Variables:
```json
{
    "nodeId": "dataset-node-id",
    "type": "SOX"
}
```

## Mutation Examples

### Create a New Node

```graphql
mutation CreateNode($input: CreateNodeInput!) {
    createNode(input: $input) {
        id
        data
        cid
        verified
        pdpProof {
            algorithm
            proof
        }
        createdAt
    }
}
```

Variables:
```json
{
    "input": {
        "data": "Sample financial dataset",
        "metadata": {
            "type": "dataset",
            "source": "Bloomberg",
            "format": "CSV"
        },
        "linkToFilecoin": true
    }
}
```

### Store Data with Automatic Provenance

```graphql
mutation StoreData($data: String!, $metadata: JSON) {
    storeData(data: $data, metadata: $metadata) {
        id
        data
        cid
        verified
        pdpProof {
            proof
            generatedAt
        }
    }
}
```

### Create Relationship Between Nodes

```graphql
mutation CreateEdge($input: CreateEdgeInput!) {
    createEdge(input: $input) {
        id
        sourceId
        targetId
        relationshipType
        transformationProof
        createdAt
    }
}
```

Variables:
```json
{
    "input": {
        "sourceId": "source-node-id",
        "targetId": "target-node-id",
        "relationshipType": "data_transformation",
        "transformationProof": "sha256:abc123..."
    }
}
```

## Advanced Queries

### Audit Trail for Compliance

```graphql
query AuditTrail($nodeId: ID!, $fromDate: DateTime, $toDate: DateTime) {
    auditTrail(nodeId: $nodeId, fromDate: $fromDate, toDate: $toDate) {
        id
        data
        metadata
        createdAt
        verified
        cid
    }
}
```

### Batch Verification

```graphql
query BatchVerify($cids: [CID!]!) {
    batchVerify(cids: $cids) {
        cid
        valid
        verifiedAt
        source
        error
    }
}
```

### Graph Statistics

```graphql
query GraphStats {
    graphStats {
        nodeCount
        edgeCount
        verifiedNodes
        totalDataSize
        averageVerificationTime
    }
    
    verificationStats(timeRange: "24h") {
        totalVerifications
        successfulVerifications
        failedVerifications
        averageTime
    }
}
```

## Error Handling

The API returns standard GraphQL errors for validation and execution errors:

```json
{
    "errors": [
        {
            "message": "Node not found",
            "locations": [{"line": 2, "column": 3}],
            "path": ["node"],
            "extensions": {
                "code": "NOT_FOUND",
                "nodeId": "invalid-id"
            }
        }
    ],
    "data": {
        "node": null
    }
}
```

## Rate Limiting

API requests are rate limited based on complexity:
- Simple queries: 1000 requests/hour
- Complex provenance queries: 100 requests/hour
- Verification operations: 500 requests/hour

## Pagination

Use cursor-based pagination for large result sets:

```graphql
query GetNodesWithPagination($cursor: String, $limit: Int = 10) {
    nodes(cursor: $cursor, limit: $limit) {
        nodes {
            id
            data
            createdAt
        }
        hasNextPage
        cursor
    }
}
```

## Subscriptions

Real-time updates for data changes:

```graphql
subscription NodeUpdates {
    nodeCreated {
        id
        data
        verified
    }
    
    verificationCompleted {
        cid
        valid
        verifiedAt
    }
    
    complianceAlert {
        reportId
        status
        findings
    }
}
```

## SDK Integration

### JavaScript/Node.js

```javascript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
    uri: 'http://localhost:4000/graphql',
    cache: new InMemoryCache(),
    headers: {
        authorization: 'Bearer your-token'
    }
});

const GET_NODES = gql`
    query GetNodes($limit: Int) {
        nodes(limit: $limit) {
            nodes {
                id
                data
                verified
            }
        }
    }
`;

const { data } = await client.query({
    query: GET_NODES,
    variables: { limit: 10 }
});
```

### Python

```python
import requests

def query_provchain(query, variables=None):
    response = requests.post(
        'http://localhost:4000/graphql',
        json={'query': query, 'variables': variables},
        headers={'Authorization': 'Bearer your-token'}
    )
    return response.json()

query = '''
    query GetProvenance($nodeId: ID!) {
        provenance(query: { nodeId: $nodeId }) {
            valid
            nodes { id data }
        }
    }
'''

result = query_provchain(query, {'nodeId': 'node-123'})
```

### LangChain Integration

```python
from langchain.document_loaders import ProvChainLoader
from langchain.vectorstores import ProvChainVectorStore

# Load verified documents
loader = ProvChainLoader(
    endpoint='http://localhost:4000/graphql',
    token='your-token',
    verify_provenance=True
)

docs = loader.load()

# Create vector store with provenance
vectorstore = ProvChainVectorStore.from_documents(
    docs, 
    embeddings,
    provenance_tracking=True
)
```
