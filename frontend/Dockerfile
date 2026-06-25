# --- BUILD STAGE ---
FROM node:20-alpine as builder

WORKDIR /frontend

# Copy package files
COPY package*.json ./

# Install dependencies (reproducible build)
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# --- SERVE STAGE ---
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /frontend/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
