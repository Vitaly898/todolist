# Stage 1: build
FROM golang:1.25-alpine AS build
WORKDIR /app

# modernc.org/sqlite — pure Go, CGO не нужен
ENV CGO_ENABLED=0

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /bin/server ./cmd/server

# Stage 2: runtime
FROM alpine:3.21
RUN apk add --no-cache ca-certificates && mkdir -p /data

COPY --from=build /bin/server /bin/server

ENV TODO_PORT=8080 \
    TODO_DB_PATH=/data/todolist.db

EXPOSE 8080

# SQLite живёт в /data — сюда монтируется volume
CMD ["/bin/server"]
