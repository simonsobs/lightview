FROM node:latest AS build

WORKDIR /app

COPY . .

RUN npm install && npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --from=build /app/dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

USER 1001
