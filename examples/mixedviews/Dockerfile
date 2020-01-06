
###
# Examples: Mixed Views
###

FROM flypapertech/avian:latest
LABEL name="mixedviews"

RUN apk update
RUN apk add alpine-sdk coreutils python3 nodejs npm redis
RUN npm install -g @flypapertech/avian
RUN npm install -g webpack

WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["avian"]
