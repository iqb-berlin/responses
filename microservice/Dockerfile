FROM node:20-alpine

WORKDIR /app

# Build context is the root of the repo (parent directory)
# Copy parent package files first
COPY package.json package-lock.json .npmrc ./

# Install parent dependencies
RUN npm ci

# Copy parent source code
COPY src ./src
COPY tsconfig.json ./

# Build the parent @iqb/responses package
# This creates the dist folder that the microservice will reference
# Use CommonJS module format for compatibility with the microservice
RUN npx tsc --module commonjs

# Now copy microservice files
COPY microservice/package.json ./microservice/

# Copy the entire microservice directory
COPY microservice ./microservice

# Switch to microservice directory
WORKDIR /app/microservice

# Install microservice dependencies
# This will link to the parent package we just built
RUN npm install

# Build the microservice
RUN npm run build

# Add version labels
ARG MS_VERSION
ARG LIB_VERSION
LABEL org.opencontainers.image.version=$MS_VERSION
LABEL de.iqb.responses.version=$LIB_VERSION

EXPOSE 3000

CMD ["npm", "start"]
