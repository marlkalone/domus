# Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Production
FROM node:22-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/main"]