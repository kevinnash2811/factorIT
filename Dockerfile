# syntax=docker/dockerfile:1

# BFF Workflow de Solicitudes — CLA
# Imagen multi-etapa: se compila con las devDependencies y se ejecuta sin ellas,
# para que la imagen final no arrastre el compilador de TypeScript ni las pruebas.

# ---------- Etapa 1: compilación ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Los manifiestos se copian solos primero: mientras package-lock.json no cambie,
# Docker reutiliza la capa del npm ci y no vuelve a bajar las dependencias.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build


# ---------- Etapa 2: dependencias de producción ----------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


# ---------- Etapa 3: runtime ----------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY package.json ./

# main.ts crea ./uploads sobre process.cwd() al arrancar. Se deja creada de
# antemano y con dueño "node" porque el proceso corre sin privilegios y en el
# volumen montado no podría crearla.
RUN mkdir -p /app/uploads && chown -R node:node /app

# La imagen base ya trae el usuario "node". Correr como root no aporta nada aquí
# y es lo primero que observa una revisión de seguridad.
USER node

EXPOSE 3000

# Se invoca node directamente, sin npm: así las señales de Docker (SIGTERM en el
# docker stop) llegan al proceso de Node y el apagado es limpio.
CMD ["node", "dist/main"]
