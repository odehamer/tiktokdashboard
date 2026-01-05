# Use official Node.js LTS Alpine image for smaller size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and node_modules
# Note: node_modules is copied from host due to npm "Exit handler never called" error
# when installing tiktok-live-connector package in Alpine Linux (npm bug in v10.8.2).
# Workaround: Run 'npm install' on host before building the Docker image.
COPY package*.json ./
COPY node_modules ./node_modules

# Copy application files
COPY server.js .
COPY index.html .
COPY dashboard.html .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set environment variable
ENV PORT=3000

# Start the application
CMD ["node", "server.js"]
