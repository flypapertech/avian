
###
# Avian Docker Image
###

FROM alpine:latest as Avian
LABEL name="Avian"
LABEL description="Create Enterprise-class component driven applications that scale."
LABEL version="latest"

RUN apk update \
    && apk add --no-cache alpine-sdk coreutils git python3 nodejs npm openrc redis

WORKDIR /tmp
RUN git clone https://github.com/flypapertech/avian \
    && cd /tmp/avian && npm install \
    && npm run build \
    && npm run test \
    && npm install -g webpack \
    && npm install -g .

ENV AVIAN_APP_HOME /usr/lib/node_modules/@flypapertech/avian/examples/hello-world
WORKDIR ${AVIAN_APP_HOME}
EXPOSE 8080
CMD ["avian"]
