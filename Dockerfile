# --- Phase 1: Build the Frontend ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
# Copy package files first for better caching
COPY client/package*.json ./
RUN npm install
# Copy the rest of the client code
COPY client/ ./
RUN npm run build

# --- Phase 2: Setup the Backend ---
FROM node:20-alpine
WORKDIR /app

RUN echo "DOCKER IS BUILDING THE FINAL IMAGE NOW"

# Set to production
ENV NODE_ENV=production

# Copy backend package files
COPY Backend/package*.json ./Backend/
RUN cd Backend && npm install --production

# Copy backend source code
COPY Backend/ ./Backend/

# Copy the built frontend from Phase 1 to the backend's public folder
# Based on your server.js, we serve from 'public'
COPY --from=client-build /app/client/build ./Backend/public

EXPOSE 5000

WORKDIR /app/Backend
CMD ["node", "server.js"]