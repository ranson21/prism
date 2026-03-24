package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
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
	r.Use(cors.Default())
	r.OPTIONS("/*any", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	risk.NewHandler(q).RegisterRoutes(api.Group("/risk"))
	scenarios.NewHandler(q).RegisterRoutes(api.Group("/scenarios"))

	// Proxy Census geocoder so the browser avoids the CORS restriction
	api.GET("/geo/fips", func(c *gin.Context) {
		lat := c.Query("lat")
		lon := c.Query("lon")
		if lat == "" || lon == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "lat and lon are required"})
			return
		}
		url := fmt.Sprintf(
			"https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=%s&y=%s&benchmark=Public_AR_Current&vintage=Current_Current&format=json",
			lon, lat,
		)
		resp, err := http.Get(url)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "census geocoder unreachable"})
			return
		}
		defer resp.Body.Close()
		var payload map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "invalid response from census geocoder"})
			return
		}
		result, _ := payload["result"].(map[string]any)
		geos, _ := result["geographies"].(map[string]any)
		counties, _ := geos["Counties"].([]any)
		if len(counties) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "no county found for coordinates"})
			return
		}
		county, _ := counties[0].(map[string]any)
		fips, _ := county["GEOID"].(string)
		c.JSON(http.StatusOK, gin.H{"fips": fips})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("PRISM API listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
