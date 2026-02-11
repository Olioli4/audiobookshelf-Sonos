# Sonos HTTP API Dockerfile for DSM7-ARM
FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Expose Sonos HTTP API port
EXPOSE 5005

# Start the server
CMD ["node", "server.js"]
