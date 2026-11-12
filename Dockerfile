FROM node:latest AS build

WORKDIR /app

COPY . .

ARG VITE_SERVICE_URL
ARG VITE_APP_NAME
ARG VITE_APP_TITLE
ARG VITE_AUTH_ENABLED
ARG VITE_LOGIN_SERVICE
ARG VITE_LOGOUT_SERVICE
ARG VITE_CROSSMATCH_ENABLED

RUN npm install && npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --from=build /app/dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf


EXPOSE 8080

USER 1001
