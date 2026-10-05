# Use official Node.js LTS slim image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application source
COPY . .

# Default port for Cloud Run (overridden dynamically by Cloud Run via PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start service
CMD ["node", "server.js"]
