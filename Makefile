.PHONY: dev server web-api build test docker docker-down docker-logs

# Только фронт (localStorage)
dev:
	cd web && npm run dev

# Только бэкенд
server:
	cd server && go run ./cmd/server

# Фронт, работающий через бэкенд (нужен `make server`)
web-api:
	cd web && VITE_USE_API=true npm run dev

build:
	cd server && go build ./... && cd ../web && npm run build

test:
	cd server && go test ./... && cd ../web && npm test

# Приложение целиком в Docker (фронт+бэкенд+SQLite): http://localhost:3000
docker:
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f
