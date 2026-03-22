# ML Pipeline

## Goal

Predict short-term county risk.

## Steps

1. Define target variable (impact probability / severity)
2. Generate training dataset
3. Train baseline models:
   - logistic regression
   - random forest
4. Evaluate
5. Store model metadata

## Rules

- time-based splits
- no leakage
- explainability required

## Outputs

- risk_score (0-100)
- risk_level
- top_drivers
