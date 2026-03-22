package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/prism/api/internal/risk"
	"github.com/prism/api/internal/scenarios"
	"github.com/prism/api/internal/store"
)

func main() {
	_ = godotenv.Load() // load .env if present (local dev)

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("ping database: %v", err)
	}
	log.Println("database connected")

	q := store.New(pool)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	risk.NewHandler(q).RegisterRoutes(r.Group("/risk"))
	scenarios.NewHandler(q).RegisterRoutes(r.Group("/scenarios"))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("PRISM API listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
