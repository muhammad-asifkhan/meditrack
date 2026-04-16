FROM node:20-alpine

WORKDIR /app

# Copy lock files first for layer caching
COPY package.json package-lock.json ./

# Install all deps (including dev for TypeScript compilation)
RUN npm ci

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

EXPOSE 3001

CMD ["node", "dist/index.js"]
