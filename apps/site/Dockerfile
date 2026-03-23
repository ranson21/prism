FROM node:22-alpine AS builder

# Mirror the repo layout so ?raw imports resolve identically in Docker and locally
WORKDIR /workspace/apps/site

COPY apps/site/package.json apps/site/package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY apps/site/ .
COPY docs/ /workspace/docs/

ARG VITE_DASHBOARD_URL=http://localhost:3000
ENV VITE_DASHBOARD_URL=$VITE_DASHBOARD_URL

RUN npm run build

# --- Runtime image ---
FROM nginx:alpine AS runner

COPY --from=builder /workspace/apps/site/dist /usr/share/nginx/html
COPY apps/site/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
