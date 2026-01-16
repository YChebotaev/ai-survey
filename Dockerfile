FROM node:20-slim

# Create nodejs user and group
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm install typescript --save-dev

# Copy source files
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
COPY index.ts server.ts ./

# Compile TypeScript and verify compilation succeeded
RUN npx tsc --project tsconfig.build.json && \
    test -f dist/server.js && \
    test -f dist/index.js && \
    test -d dist/src/lib/migrations && \
    echo "TypeScript compilation successful"

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R nodejs:nodejs /app

# Switch to nodejs user
USER nodejs:nodejs

# Expose port (adjust if needed based on your env)
EXPOSE 3000

# Run the compiled application
CMD ["node", "dist/server.js"]
