package scenarios

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
	rg.GET("", h.list)
	rg.POST("/simulate", h.simulate)
}

func (h *Handler) list(c *gin.Context) {
	scenarios, err := h.q.ListScenarios(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"scenarios": scenarios})
}

type SimulateRequest struct {
	Name              string   `json:"name" binding:"required"`
	Description       string   `json:"description"`
	SeverityMultipler float64  `json:"severity_multiplier" binding:"required,min=0.1,max=5.0"`
	FIPSCodes         []string `json:"fips_codes"` // empty = all counties
}

func (h *Handler) simulate(c *gin.Context) {
	var req SimulateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	params, _ := json.Marshal(req)
	scenario, err := h.q.CreateScenario(c.Request.Context(), store.CreateScenarioParams{
		Name:        req.Name,
		Description: strPtr(req.Description),
		CreatedBy:   nil,
		Parameters:  json.RawMessage(params),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	baseline, err := h.q.GetRankings(c.Request.Context(), store.GetRankingsParams{
		Limit: 3220, Offset: 0,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fipsFilter := map[string]bool{}
	for _, f := range req.FIPSCodes {
		fipsFilter[f] = true
	}

	type simResult struct {
		FIPSCode           string  `json:"fips_code"`
		CountyName         string  `json:"county_name"`
		StateAbbr          string  `json:"state_abbr"`
		BaselineScore      float64 `json:"baseline_score"`
		SimulatedRiskScore float64 `json:"simulated_risk_score"`
		SimulatedRiskLevel string  `json:"simulated_risk_level"`
		DeltaFromBaseline  float64 `json:"delta_from_baseline"`
	}

	var results []simResult
	for _, r := range baseline {
		if len(fipsFilter) > 0 && !fipsFilter[r.FipsCode] {
			continue
		}
		baseF, err := numericToFloat(r.RiskScore)
		if err != nil {
			continue
		}
		simScore := clamp(baseF*req.SeverityMultipler, 0, 100)
		delta := simScore - baseF
		level := riskLevel(simScore)

		_ = h.q.UpsertScenarioResult(c.Request.Context(), store.UpsertScenarioResultParams{
			ScenarioID:         scenario.ID,
			FipsCode:           r.FipsCode,
			SimulatedRiskScore: floatToNumeric(simScore),
			SimulatedRiskLevel: strPtr(level),
			DeltaFromBaseline:  floatToNumeric(delta),
			TopDrivers:         r.TopDrivers,
		})

		results = append(results, simResult{
			FIPSCode:           r.FipsCode,
			CountyName:         r.CountyName,
			StateAbbr:          r.StateAbbr,
			BaselineScore:      baseF,
			SimulatedRiskScore: simScore,
			SimulatedRiskLevel: level,
			DeltaFromBaseline:  delta,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"scenario_id": scenario.ID,
		"name":        scenario.Name,
		"results":     results,
		"total":       len(results),
	})
}

func numericToFloat(n pgtype.Numeric) (float64, error) {
	v, err := n.Float64Value()
	if err != nil {
		return 0, err
	}
	return v.Float64, nil
}

func floatToNumeric(f float64) pgtype.Numeric {
	s := strconv.FormatFloat(f, 'f', 2, 64)
	var n pgtype.Numeric
	_ = n.Scan(s)
	return n
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func riskLevel(score float64) string {
	switch {
	case score >= 75:
		return "critical"
	case score >= 50:
		return "elevated"
	case score >= 25:
		return "moderate"
	default:
		return "low"
	}
}
