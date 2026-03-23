package db

import (
	"context"
	"fmt"
	"net/url"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPool builds a connection pool from individual DB_* env vars.
// DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD are required.
// DB_PORT defaults to 5432.
func NewPool(ctx context.Context) (*pgxpool.Pool, error) {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	name := os.Getenv("DB_NAME")
	user := os.Getenv("DB_USER")
	pass := os.Getenv("DB_PASSWORD")

	if port == "" {
		port = "5432"
	}
	if host == "" || name == "" || user == "" || pass == "" {
		return nil, fmt.Errorf("DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD are required")
	}

	dsn := fmt.Sprintf("postgresql://%s:%s@%s:%s/%s",
		url.QueryEscape(user),
		url.QueryEscape(pass),
		host, port, name,
	)

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}
