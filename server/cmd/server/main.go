package main

import (
	"fmt"
	"log"
	"net/http"

	"todolist/server/internal/config"
	"todolist/server/internal/db"
	"todolist/server/internal/httpapi"
	"todolist/server/internal/store"
)

func main() {
	cfg := config.Load()

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer database.Close()

	st := store.New(database)
	srv := httpapi.NewServer(st)

	addr := ":" + cfg.Port
	fmt.Printf("TODOLIST server listening on %s\n", addr)
	if err := http.ListenAndServe(addr, srv.Router()); err != nil {
		log.Fatalf("server: %v", err)
	}
}
