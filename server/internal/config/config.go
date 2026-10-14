package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	DBPath string
	Port   string
}

func Load() Config {
	dbPath := os.Getenv("TODO_DB_PATH")
	if dbPath == "" {
		home, _ := os.UserHomeDir()
		dbPath = filepath.Join(home, ".todolist", "todolist.db")
	}
	port := os.Getenv("TODO_PORT")
	if port == "" {
		port = "8080"
	}
	return Config{DBPath: dbPath, Port: port}
}
