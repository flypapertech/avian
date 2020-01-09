
###
# Avian
###

FROM alpine:edge as Avian
LABEL name="Avian"
LABEL description="Create Enterprise-class component driven applications that scale."
LABEL version="latest"

RUN apk update
RUN apk add bash alpine-sdk coreutils git python3 nodejs npm openrc redis
RUN npm install -g webpack

WORKDIR /tmp
RUN git clone https://github.com/flypapertech/avian
WORKDIR /tmp/avian
RUN npm install
RUN npm run build
RUN npm run test
RUN npm install -g .

ENV AVIAN_APP_HOME /usr/lib/node_modules/@flypapertech/avian/examples/hello-world
EXPOSE 8080
CMD ["avian"]
