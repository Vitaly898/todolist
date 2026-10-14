# Stage 1: build frontend
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci страдает багом опциональных нативных зависимостей (npm/cli#4828) —
# npm install доустанавливает нужную платформенную биндингу rolldown
RUN npm install --no-audit --no-fund

COPY . .

# Включаем API-режим фронтенда (fetch на /api)
ARG VITE_USE_API=true
ENV VITE_USE_API=$VITE_USE_API

RUN npm run build

# Stage 2: serve via nginx
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
