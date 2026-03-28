# Docker Registry Integration Guide

Dieser Guide erklärt, wie du den Responses-Microservice in einer Docker Registry bereitstellst und wie andere Projekte die Images nutzen können.

## Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Docker Registry Optionen](#docker-registry-optionen)
3. [Image vorbereiten und taggen](#image-vorbereiten-und-taggen)
4. [In Registry veröffentlichen](#in-registry-veröffentlichen)
5. [Image in anderen Projekten nutzen](#image-in-anderen-projekten-nutzen)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Überblick

Der Responses-Microservice kann als Docker Image in verschiedenen Container Registries bereitgestellt werden:

- **Docker Hub** (öffentlich oder privat)
- **GitHub Container Registry (ghcr.io)** (empfohlen für GitHub-Projekte)
- **GitLab Container Registry**
- **Private Registry** (selbst gehostet)
- **Cloud Registries** (AWS ECR, Google GCR, Azure ACR)

## Docker Registry Optionen

### Option 1: GitHub Container Registry (Empfohlen)

**Vorteile:**
- Kostenlos für öffentliche Repositories
- Direkte Integration mit GitHub
- Gute Performance
- Automatisierung via GitHub Actions möglich

**URL-Format:** `ghcr.io/iqb-berlin/responses-microservice`

### Option 2: Docker Hub

**Vorteile:**
- Weit verbreitet und bekannt
- Kostenlose öffentliche Images
- Einfache Nutzung

**URL-Format:** `iqbberlin/responses-microservice`

### Option 3: Private Registry

**Vorteile:**
- Volle Kontrolle
- Keine externen Abhängigkeiten
- Ideal für interne Projekte

**URL-Format:** `registry.iqb.de/responses-microservice`

## Image vorbereiten und taggen

### 1. Image bauen

```bash
# Im responses Repository-Root
cd /Users/julian/iqb-dev/responses

# Image bauen
./microservice/docker-build.sh
```

### 2. Image taggen

Das Image wird mit einer Hierarchie von Tags versehen, um sowohl die Microservice-Version als auch die Version der verwendeten `@iqb/responses` Bibliothek abzubilden:

```bash
# Nutze das Script für automatisches Tagging (empfohlen)
cd microservice
./docker-tag.sh
```

**Die neue Tag-Strategie:**

1. **Kombinierter Tag (Eindeutig)**:
   - `m1.0.0-l5.0.0` - Fixiert sowohl Microservice (`m`) als auch Library (`l`). Dies ist der sicherste Tag für Produktion.

2. **Microservice Tags (Standard)**:
   - `1.0.0` - Spezifische Microservice-Version.
   - `1.0` - Major.Minor Version des Microservices.
   - `1` - Major Version des Microservices.

3. **Library Tags (Referenz)**:
   - `lib5.0.0` - Die Version der enthaltenen `@iqb/responses` Bibliothek.
   - `lib5.0` - Major.Minor der Bibliothek.

4. **Latest**:
   - `latest` - Die absolut neueste Version.

**Beispiel GHCR:**
- `ghcr.io/iqb-berlin/responses-microservice:m1.0.0-l5.0.0`
- `ghcr.io/iqb-berlin/responses-microservice:1.0.0`
- `ghcr.io/iqb-berlin/responses-microservice:lib5.0.0`

## In Registry veröffentlichen

### GitHub Container Registry

#### 1. Authentifizierung

```bash
# Personal Access Token erstellen auf GitHub:
# Settings → Developer settings → Personal access tokens → Tokens (classic)
# Scopes: write:packages, read:packages, delete:packages

# Login
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

#### 2. Image pushen

```bash
docker push ghcr.io/iqb-berlin/responses-microservice:latest
docker push ghcr.io/iqb-berlin/responses-microservice:5.0.0
docker push ghcr.io/iqb-berlin/responses-microservice:5.0
```

#### 3. Image öffentlich machen (optional)

1. Gehe zu https://github.com/orgs/iqb-berlin/packages
2. Wähle das Package `responses-microservice`
3. Package settings → Change visibility → Public

### Docker Hub

#### 1. Authentifizierung

```bash
docker login
# Username und Password eingeben
```

#### 2. Image pushen

```bash
docker push iqbberlin/responses-microservice:latest
docker push iqbberlin/responses-microservice:5.0.0
docker push iqbberlin/responses-microservice:5.0
```

### Private Registry

#### 1. Authentifizierung

```bash
docker login registry.iqb.de
# Credentials eingeben
```

#### 2. Image pushen

```bash
docker push registry.iqb.de/responses-microservice:latest
docker push registry.iqb.de/responses-microservice:5.0.0
```

## Image in anderen Projekten nutzen

### Methode 1: Docker Run (Standalone)

```bash
# Von GitHub Container Registry
docker pull ghcr.io/iqb-berlin/responses-microservice:5.0.0
docker run -d -p 3000:3000 --name responses-service \
  ghcr.io/iqb-berlin/responses-microservice:5.0.0

# Von Docker Hub
docker pull iqbberlin/responses-microservice:5.0.0
docker run -d -p 3000:3000 --name responses-service \
  iqbberlin/responses-microservice:5.0.0
```

### Methode 2: Docker Compose

Erstelle eine `docker-compose.yml` in deinem Projekt:

```yaml
version: '3.8'

services:
  responses-microservice:
    image: ghcr.io/iqb-berlin/responses-microservice:5.0.0
    container_name: responses-service
    ports:
      - "3000:3000"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Deine eigene Anwendung
  my-app:
    build: .
    ports:
      - "8080:8080"
    depends_on:
      - responses-microservice
    environment:
      - RESPONSES_SERVICE_URL=http://responses-microservice:3000
```

Starten:

```bash
docker-compose up -d
```

### Methode 3: Kubernetes

Erstelle ein Deployment (`responses-deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: responses-microservice
  labels:
    app: responses-microservice
spec:
  replicas: 2
  selector:
    matchLabels:
      app: responses-microservice
  template:
    metadata:
      labels:
        app: responses-microservice
    spec:
      containers:
      - name: responses-microservice
        image: ghcr.io/iqb-berlin/responses-microservice:5.0.0
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: responses-microservice
spec:
  selector:
    app: responses-microservice
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

Deployen:

```bash
kubectl apply -f responses-deployment.yaml
```

### Methode 4: In eigenem Dockerfile als Base Image

```dockerfile
FROM ghcr.io/iqb-berlin/responses-microservice:5.0.0

# Eigene Anpassungen hinzufügen
COPY custom-config.json /app/config.json

# Oder als Multi-Stage Build
FROM node:20-alpine AS builder
# ... dein Build-Prozess

FROM ghcr.io/iqb-berlin/responses-microservice:5.0.0
COPY --from=builder /app/dist /app/custom
```

## Integration in Anwendungen

### REST API Nutzung

Der Microservice bietet einen `/codings/code` Endpoint:

**Beispiel in Node.js/TypeScript:**

```typescript
import axios from 'axios';

const RESPONSES_SERVICE_URL = process.env.RESPONSES_SERVICE_URL || 'http://localhost:3000';

async function codeResponses(responses: any, codingScheme: any, variableInfos: any) {
  try {
    const response = await axios.post(`${RESPONSES_SERVICE_URL}/codings/code`, {
      responses,
      codingScheme,
      variableInfos
    });
    return response.data;
  } catch (error) {
    console.error('Coding failed:', error);
    throw error;
  }
}

// Verwendung
const result = await codeResponses(
  myResponses,
  myCodingScheme,
  myVariableInfos
);
```

**Beispiel in Java (Spring Boot):**

```java
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;

@Service
public class ResponsesService {
    
    private final RestTemplate restTemplate;
    private final String responsesServiceUrl;
    
    public ResponsesService(RestTemplate restTemplate,
                           @Value("${responses.service.url:http://localhost:3000}") 
                           String responsesServiceUrl) {
        this.restTemplate = restTemplate;
        this.responsesServiceUrl = responsesServiceUrl;
    }
    
    public CodingResult codeResponses(Object responses, 
                                     Object codingScheme, 
                                     Object variableInfos) {
        String url = responsesServiceUrl + "/codings/code";
        
        Map<String, Object> request = new HashMap<>();
        request.put("responses", responses);
        request.put("codingScheme", codingScheme);
        request.put("variableInfos", variableInfos);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
        
        ResponseEntity<CodingResult> response = restTemplate.postForEntity(
            url, 
            entity, 
            CodingResult.class
        );
        
        return response.getBody();
    }
}
```

**Beispiel in Python:**

```python
import requests
import os

RESPONSES_SERVICE_URL = os.getenv('RESPONSES_SERVICE_URL', 'http://localhost:3000')

def code_responses(responses, coding_scheme, variable_infos):
    url = f"{RESPONSES_SERVICE_URL}/codings/code"
    
    payload = {
        'responses': responses,
        'codingScheme': coding_scheme,
        'variableInfos': variable_infos
    }
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    
    return response.json()

# Verwendung
result = code_responses(my_responses, my_coding_scheme, my_variable_infos)
```

## Best Practices

### 1. Versionierung

- **Immer spezifische Versionen verwenden** in Produktion (nicht `latest`)
- **Semantic Versioning** befolgen (MAJOR.MINOR.PATCH)
- **Tags pflegen**: Sowohl `5.0.0` als auch `5.0` und `5` bereitstellen

### 2. Security

- **Regelmäßige Updates** des Base Images (`node:20-alpine`)
- **Vulnerability Scanning** durchführen:
  ```bash
  docker scan ghcr.io/iqb-berlin/responses-microservice:5.0.0
  ```
- **Private Images** für sensible Anwendungen nutzen

### 3. CI/CD Integration

Beispiel GitHub Actions Workflow (`.github/workflows/publish-docker.yml`):

```yaml
name: Publish Docker Image

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/iqb-berlin/responses-microservice
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest,enable={{is_default_branch}}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./microservice/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 4. Monitoring & Logging

In Docker Compose:

```yaml
services:
  responses-microservice:
    image: ghcr.io/iqb-berlin/responses-microservice:5.0.0
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    labels:
      - "com.example.monitoring=true"
```

### 5. Resource Limits

```yaml
services:
  responses-microservice:
    image: ghcr.io/iqb-berlin/responses-microservice:5.0.0
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Troubleshooting

### Problem: Image kann nicht gepullt werden

```bash
# Authentifizierung prüfen
docker login ghcr.io

# Image-Name prüfen
docker pull ghcr.io/iqb-berlin/responses-microservice:5.0.0 --debug
```

### Problem: Container startet nicht

```bash
# Logs anzeigen
docker logs responses-service

# Container inspizieren
docker inspect responses-service

# Interaktiv debuggen
docker run -it --entrypoint /bin/sh ghcr.io/iqb-berlin/responses-microservice:5.0.0
```

### Problem: Netzwerk-Verbindung zu anderem Container

```bash
# Netzwerk prüfen
docker network ls
docker network inspect bridge

# Container im gleichen Netzwerk starten
docker network create responses-network
docker run -d --network responses-network --name responses-service \
  ghcr.io/iqb-berlin/responses-microservice:5.0.0
```

### Problem: Private Registry Zugriff

```bash
# Für private GitHub Packages
docker login ghcr.io -u USERNAME -p $GITHUB_TOKEN

# Image Pull Secret in Kubernetes
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=USERNAME \
  --docker-password=$GITHUB_TOKEN \
  --docker-email=email@example.com
```

## Weitere Ressourcen

- [Docker Documentation](https://docs.docker.com/)
- [GitHub Container Registry Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Hub](https://hub.docker.com/)
- [Microservice README](./README.md)
