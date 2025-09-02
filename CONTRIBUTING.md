# Contributing to ProvChain

We welcome contributions from the community! This guide will help you get started with contributing to ProvChain.

## 🎯 Ways to Contribute

- **Bug Reports**: Found a bug? Please report it!
- **Feature Requests**: Have an idea for improvement? We'd love to hear it!
- **Code Contributions**: Submit pull requests for bug fixes or new features
- **Documentation**: Help improve our documentation and examples
- **Testing**: Add test cases and improve test coverage
- **Performance**: Optimize algorithms and data structures

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git
- Basic knowledge of GraphQL and Filecoin

### Setup Development Environment

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/provchain.git
   cd provchain
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Verify everything works**
   ```bash
   curl http://localhost:4000/graphql
   ```

## 📝 Development Guidelines

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check linting
npm run lint

# Auto-fix formatting
npm run format
```

### Commit Messages

Use conventional commits format:

```
feat: add new GraphQL mutation for batch node creation
fix: resolve PDP verification timeout issue
docs: update API reference with new examples
test: add integration tests for provenance chains
```

### Branch Naming

- Feature branches: `feature/your-feature-name`
- Bug fixes: `fix/issue-description`
- Documentation: `docs/what-you-updated`

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-new-feature
   ```

2. **Make your changes**
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/amazing-new-feature
   ```

6. **Create a Pull Request**
   - Use a descriptive title
   - Explain what your PR does
   - Reference any related issues
   - Include screenshots if applicable

## 🧪 Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/test.js

# Run with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

### Writing Tests

We use Jest for testing. Here's the structure:

```javascript
describe('Feature Name', () => {
    beforeEach(() => {
        // Setup code
    });

    test('should do something specific', () => {
        // Test implementation
        expect(result).toBe(expected);
    });
});
```

### Test Coverage

Aim for >90% test coverage for new code:
- Unit tests for individual functions
- Integration tests for API endpoints
- End-to-end tests for complete workflows

## 📚 Documentation

### API Documentation

Update `docs/api-reference.md` when adding new GraphQL types or resolvers:

```markdown
### New Query/Mutation

Description of what it does.

```graphql
query NewQuery($param: String!) {
    newField(param: $param) {
        result
    }
}
```

Variables:
```json
{
    "param": "example"
}
```
```

### Code Documentation

Use JSDoc comments for functions:

```javascript
/**
 * Creates a new provenance node with verification
 * @param {string} data - The data to store
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<ProvenanceNode>} The created node
 */
async function createNode(data, metadata) {
    // Implementation
}
```

## 🔧 Technical Areas for Contribution

### 1. Core Graph Database

**Location**: `src/provchain-core.js`

**Opportunities**:
- Optimize graph traversal algorithms
- Implement advanced indexing strategies
- Add graph analytics functions
- Improve memory management

**Skills Needed**: JavaScript, Graph Theory, Data Structures

### 2. Filecoin Integration

**Location**: `src/filecoin-storage.js`

**Opportunities**:
- Implement real Filecoin client integration
- Optimize PDP proof generation
- Add retrieval market support
- Implement storage deal management

**Skills Needed**: Filecoin Protocol, IPFS, Cryptography

### 3. GraphQL API

**Location**: `src/graphql-api.js`

**Opportunities**:
- Add new query types
- Implement subscriptions
- Optimize resolver performance
- Add input validation

**Skills Needed**: GraphQL, Apollo Server, Schema Design

### 4. Performance Optimization

**Opportunities**:
- Database query optimization
- Caching strategies
- Parallel processing
- Memory usage reduction

**Skills Needed**: Performance Profiling, Algorithms, Caching

### 5. Compliance Features

**Opportunities**:
- SOX compliance reporting
- GDPR data lineage
- HIPAA audit trails
- Custom compliance frameworks

**Skills Needed**: Regulatory Knowledge, Reporting, Data Governance

### 6. AI/ML Integration

**Opportunities**:
- LangChain connectors
- RAG pipeline optimization
- ML model provenance
- Automated data quality scoring

**Skills Needed**: Machine Learning, LangChain, Python

## 🚨 Issue Guidelines

### Bug Reports

Use this template:

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**  
What actually happens

**Environment**
- OS: macOS/Linux/Windows
- Node.js version: 
- ProvChain version:

**Additional Context**
Any other relevant information
```

### Feature Requests

Use this template:

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should this be implemented?

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
Mockups, examples, references
```

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Special thanks in documentation
- Potential speaking opportunities

## 📞 Getting Help

- **Discord**: Join our [developer community](https://discord.gg/provchain)
- **GitHub Discussions**: Ask questions and share ideas
- **Email**: dev@provchain.io for technical questions
- **Office Hours**: Weekly developer office hours (see calendar)

## 📋 Contributor License Agreement

By contributing to ProvChain, you agree that your contributions will be licensed under the same license as the project (MIT License).

## 🎉 Thank You!

Every contribution, no matter how small, helps make ProvChain better. Thank you for being part of building the trust layer for the AI economy!

---

**Happy Coding! 🚀**
