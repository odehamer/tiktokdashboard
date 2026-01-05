# Use official Node.js LTS Alpine image for smaller size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and node_modules
# Note: node_modules is copied from host due to npm install issues in Alpine
# with the tiktok-live-connector package. For production, ensure dependencies 
# are installed on the host system before building the image.
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
