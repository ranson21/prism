package risk

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/prism/api/internal/store"
)

type Handler struct {
	q *store.Queries
}

func NewHandler(q *store.Queries) *Handler {
	return &Handler{q: q}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/summary", h.summary)
	rg.GET("/rankings", h.rankings)
	rg.GET("/explain/:fips", h.explain)
}

func (h *Handler) summary(c *gin.Context) {
	rows, err := h.q.GetRiskSummary(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dist := gin.H{"critical": 0, "elevated": 0, "moderate": 0, "low": 0}
	total := 0
	for _, row := range rows {
		dist[row.RiskLevel] = row.CountyCount
		total += int(row.CountyCount)
	}

	top, err := h.q.GetRankings(c.Request.Context(), store.GetRankingsParams{Limit: 5, Offset: 0})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total_counties_scored": total,
		"distribution":          dist,
		"top_counties":          formatRankings(top),
	})
}

func (h *Handler) rankings(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit > 500 {
		limit = 500
	}

	total, err := h.q.CountRankings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rows, err := h.q.GetRankings(c.Request.Context(), store.GetRankingsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"rankings": formatRankings(rows),
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

func (h *Handler) explain(c *gin.Context) {
	fips := c.Param("fips")

	score, err := h.q.GetCountyScore(c.Request.Context(), fips)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "county not found"})
		return
	}

	features, err := h.q.GetCountyFeatures(c.Request.Context(), fips)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "features not found for county"})
		return
	}

	var drivers any
	_ = json.Unmarshal(score.TopDrivers, &drivers)

	c.JSON(http.StatusOK, gin.H{
		"fips_code":   score.FipsCode,
		"county_name": score.CountyName,
		"state_name":  score.StateName,
		"state_abbr":  score.StateAbbr,
		"population":  score.Population,
		"risk_score":  numericToFloat(score.RiskScore),
		"risk_level":  score.RiskLevel,
		"top_drivers": drivers,
		"score_date":  score.ScoreDate.Time.Format("2006-01-02"),
		"features": gin.H{
			"disaster_count":           features.DisasterCount,
			"major_disaster_count":     features.MajorDisasterCount,
			"severe_weather_count":     features.SevereWeatherCount,
			"earthquake_count":         features.EarthquakeCount,
			"max_earthquake_magnitude": features.MaxEarthquakeMagnitude,
			"population_exposure":      features.PopulationExposure,
			"hazard_frequency_score":   features.HazardFrequencyScore,
		},
	})
}

func formatRankings(rows []store.GetRankingsRow) []gin.H {
	out := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		var drivers any
		_ = json.Unmarshal(r.TopDrivers, &drivers)
		out = append(out, gin.H{
			"rank":        r.Rank,
			"fips_code":   r.FipsCode,
			"county_name": r.CountyName,
			"state_abbr":  r.StateAbbr,
			"population":  r.Population,
			"risk_score":  numericToFloat(r.RiskScore),
			"risk_level":  r.RiskLevel,
			"top_drivers": drivers,
			"score_date":  r.ScoreDate.Time.Format("2006-01-02"),
		})
	}
	return out
}

func numericToFloat(n pgtype.Numeric) float64 {
	f, _ := n.Float64Value()
	return f.Float64
}
