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

# Install envsubst for runtime config injection
RUN apk add --no-cache gettext

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /frontend/dist /usr/share/nginx/html

# Copy config template (not config.js, which is generated at runtime)
COPY public/config.template.js /usr/share/nginx/html/config.template.js

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=60s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Inject API_URL at runtime via envsubst, then start nginx
CMD ["/bin/sh", "-c", "envsubst '$API_URL' < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js && nginx -g 'daemon off;'"]
