# Responses Microservice

This microservice wraps the `@iqb/responses` library, exposing its functionality via a REST API.

## API Endpoints

### Coding

#### `POST /codings/code`
Code a single response using a specific coding definition.
*   **Request Body**:
    *   `response`: The response object (e.g., `{ id, value, status }`).
    *   `coding`: The coding definition object.
*   **Response**: The coded result (e.g., score, code, etc.).

#### `POST /schemes/code`
Code a set of responses using a complete variable coding scheme.
*   **Request Body**:
    *   `unitResponses`: Array of unit responses.
    *   `variableCodings`: Array of variable coding definitions.
*   **Response**: Array of coding results.

#### `POST /schemes/validate`
Validate a coding scheme against a set of base variables.
*   **Request Body**:
    *   `baseVariables`: Array of base variable definitions.
    *   `variableCodings`: Array of variable coding definitions.
*   **Response**: parsing/validation report associated with the scheme.

#### `POST /schemes/derive-value`
Derive a value for a variable based on other variable values (derivation rule).
*   **Request Body**:
    *   `variableCodings`: Array of variable coding definitions (context).
    *   `coding`: The specific coding definition for the derived variable.
    *   `sourceResponses`: Array of responses from source variables.
*   **Response**: The derived value.

### Text Rendering (ToTextFactory)

#### `POST /text/code`
Generate a text description for a specific code rule.
*   **Request Body**:
    *   `code`: The code definition object.
    *   `mode`: (Optional) Text generation mode (default: `'EXTENDED'`).
*   **Response**: String representation of the code rule.

#### `POST /text/source`
Generate a text description for a source definition (e.g., how a variable is derived).
*   **Request Body**:
    *   `variableId`: The ID of the variable.
    *   `sourceType`: The type of source (e.g., `'BASE'`, `'COPY_VALUE'`, `'CONCAT_CODE'`, etc.).
    *   `sources`: Array of source variable command content.
    *   `parameters`: (Optional) Additional processing parameters.
*   **Response**: `{ text: string }`

#### `POST /text/processing`
Generate a text description for processing instructions.
*   **Request Body**:
    *   `processing`: Array of processing instructions.
    *   `fragmenting`: (Optional) Fragmenting instruction.
*   **Response**: `{ text: string }`

#### `POST /text/var-info`
Generate a text description for general variable information.
*   **Request Body**:
    *   `varInfo`: Variable info object.
*   **Response**: String representation of the variable info.

## Docker Usage

### Using Pre-built Images from Registry

The microservice is available as a pre-built Docker image from multiple registries:

```bash
# From GitHub Container Registry (recommended)
docker pull ghcr.io/iqb-berlin/responses-microservice:5.0.0

# From Docker Hub
docker pull iqbberlin/responses-microservice:5.0.0

# Run the image
docker run -d -p 3000:3000 ghcr.io/iqb-berlin/responses-microservice:5.0.0
```

**📚 For detailed instructions on:**
- Publishing to Docker registries
- Integration in other projects
- CI/CD automation
- Kubernetes deployment

**See [DOCKER_REGISTRY.md](./DOCKER_REGISTRY.md)**

### Build Locally

If you want to build the image yourself:

```bash
# Using the build script
./docker-build.sh

# Or manually
docker build -f microservice/Dockerfile -t responses-microservice .
```

### Docker Compose Example
To use this service in your application stack, add it to your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Your main application
  my-app:
    image: my-app-image
    depends_on:
      - responses-service
    environment:
      - RESPONSES_SERVICE_URL=http://responses-service:3000

  # The responses microservice (using pre-built image)
  responses-service:
    image: ghcr.io/iqb-berlin/responses-microservice:5.0.0
    # Or build locally:
    # build:
    #   context: . # Adjust path to the responses-microservice directory
    #   dockerfile: Dockerfile
    ports:
      - "3000:3000"
    restart: unless-stopped
```

For a complete docker-compose example, see [docker-compose.example.yml](./docker-compose.example.yml)

## Example Usage from Another App

Assuming your app can make HTTP requests (e.g., using `fetch` or `axios`):

```typescript
const response = await fetch('http://responses-service:3000/codings/code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    response: { id: 'var1', value: 'hello', status: 'VALUE_CHANGED' },
    coding: { id: 'var1', codes: [] } // ... coding definition
  })
});
const result = await response.json();
```
