package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/prism/api/internal/db"
	"github.com/prism/api/internal/risk"
	"github.com/prism/api/internal/scenarios"
	"github.com/prism/api/internal/store"
)

func main() {
	_ = godotenv.Load() // load .env if present (local dev)

	ctx := context.Background()
	pool, err := db.NewPool(ctx)
	if err != nil {
		log.Fatalf("connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("database connected")

	q := store.New(pool)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	risk.NewHandler(q).RegisterRoutes(api.Group("/risk"))
	scenarios.NewHandler(q).RegisterRoutes(api.Group("/scenarios"))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("PRISM API listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
