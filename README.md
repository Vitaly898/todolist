# Todolist

Умный планировщик задач: календарь (день/неделя/месяц), размазывание естимейтов по дням, pomodoro. Фронтенд — React + Vite, бэкенд — Go + chi + SQLite.

## Запуск в Docker (всё приложение одной командой)

```bash
make docker            # = docker compose up --build
```

Открой http://localhost:3000 — фронтенд, бэкенд и SQLite работают в контейнерах.
Данные хранятся в volume `todolist-data` и переживают перезапуски.

```bash
make docker-down       # остановить
make docker-logs       # логи в реальном времени
```

Архитектура контейнеров: `web` (nginx отдаёт собранный фронт и проксирует `/api` → `server:8080`) и `server` (Go-бинарник, SQLite в `/data`).

## Локальная разработка (без Docker)

```bash
make dev        # фронт на :5173 (данные в localStorage)
make server     # бэкенд на :8080
make web-api    # фронт на :5173 через бэкенд (нужен `make server`)
make build      # собрать оба
make test       # тесты обоих
```

Подробный план развития — в [PLAN.md](./PLAN.md).
