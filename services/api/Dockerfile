FROM golang:1.25-alpine AS builder

WORKDIR /build

# Download dependencies first for layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build a static binary
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o prism-api ./cmd/main.go

# --- Runtime image ---
FROM alpine:3.20 AS runner

# ca-certificates for outbound HTTPS; tzdata for time zone support
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /build/prism-api .

EXPOSE 8080
CMD ["./prism-api"]
