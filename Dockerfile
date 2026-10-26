FROM node:22-alpine
WORKDIR /app
ARG VERSION=""
COPY --chown=node:node server.js updater.js package.json ./
COPY --chown=node:node public ./public
RUN chown node:node /app && echo "$VERSION" > VERSION && chown node:node VERSION
ENV NODE_ENV=production PORT=8080
USER node
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.js"]
