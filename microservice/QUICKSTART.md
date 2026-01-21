# Quick Start: Using Responses Microservice in Your Project

This guide shows you how to quickly integrate the Responses Microservice into your project.

## 1. Add to Docker Compose

Create or update your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  responses-microservice:
    image: ghcr.io/iqb-berlin/responses-microservice:5.0.0
    ports:
      - "3000:3000"
    restart: unless-stopped
```

Start the service:

```bash
docker-compose up -d
```

## 2. Use the API

### Node.js/TypeScript Example

```typescript
import axios from 'axios';

const RESPONSES_URL = 'http://localhost:3000';

// Code responses
const result = await axios.post(`${RESPONSES_URL}/codings/code`, {
  response: { id: 'var1', value: 'hello', status: 'VALUE_CHANGED' },
  coding: { id: 'var1', codes: [] }
});

console.log(result.data);
```

### Java Example

```java
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;
import java.util.HashMap;
import java.util.Map;

public class ResponseCoder {
    public void code() {
        RestTemplate restTemplate = new RestTemplate();
        String url = "http://localhost:3000/codings/code";

        Map<String, Object> request = new HashMap<>();
        request.put("response", responseData);
        request.put("coding", codingData);

        ResponseEntity<CodingResult> response = 
            restTemplate.postForEntity(url, request, CodingResult.class);
    }
}
```

### Python Example

```python
import requests

url = "http://localhost:3000/codings/code"
response = requests.post(url, json={
    'response': {'id': 'var1', 'value': 'hello', 'status': 'VALUE_CHANGED'},
    'coding': {'id': 'var1', 'codes': []}
})

print(response.json())
```

## 3. Available Endpoints

- `POST /codings/code` - Code a single response
- `POST /schemes/code` - Code multiple responses with a scheme
- `POST /schemes/validate` - Validate a coding scheme
- `POST /schemes/derive-value` - Derive values from other variables
- `POST /text/code` - Generate text description for code rules
- `POST /text/source` - Generate text for source definitions
- `POST /text/processing` - Generate text for processing instructions
- `POST /text/var-info` - Generate text for variable info

## 4. Health Check

```bash
curl http://localhost:3000/
```

## Need More Details?

- **Full Documentation**: [DOCKER_REGISTRY.md](./DOCKER_REGISTRY.md)
- **API Reference**: [README.md](./README.md)
- **Docker Compose Example**: [docker-compose.example.yml](./docker-compose.example.yml)
- **Publishing Guide**: See DOCKER_REGISTRY.md for publishing to registries
