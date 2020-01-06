
###
# Avian
###

FROM alpine:edge as Avian
LABEL name="Avian"
LABEL version="latest"

RUN apk update
RUN apk add alpine-sdk coreutils python3 nodejs npm redis
RUN npm install -g @flypapertech/avian
RUN npm install -g webpack
WORKDIR /app

EXPOSE 8080
CMD ["avian"]
