
###
# Avian
###

FROM alpine:edge as Avian
LABEL name="Avian"
LABEL description="Create Enterprise-class component driven applications that scale."
LABEL version="latest"

WORKDIR /app

RUN apk update
RUN apk add bash alpine-sdk coreutils python3 nodejs npm
RUN npm install -g webpack
RUN npm install -g @flypapertech/avian

COPY ./examples/hello-world /app/hello-world

ENV AVIAN_APP_HOME /app
EXPOSE 8080
CMD ["avian"]
