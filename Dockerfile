FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/server
RUN apk add --no-cache su-exec
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client-build /app/client/dist ./public
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && mkdir -p /var/data/uploads && chown -R node:node /app/server
EXPOSE 5000
CMD ["/app/entrypoint.sh"]
