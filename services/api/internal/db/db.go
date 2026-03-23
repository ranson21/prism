package db

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if pw := os.Getenv("DB_PASSWORD"); pw != "" {
		cfg, err := pgxpool.ParseConfig(dsn)
		if err != nil {
			return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
		}
		cfg.ConnConfig.Password = pw
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			return nil, fmt.Errorf("connect to database: %w", err)
		}
		if err := pool.Ping(ctx); err != nil {
			pool.Close()
			return nil, fmt.Errorf("ping database: %w", err)
		}
		return pool, nil
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}
