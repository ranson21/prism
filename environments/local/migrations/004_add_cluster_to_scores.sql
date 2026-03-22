-- Add K-Means cluster assignment to risk.scores.
-- cluster_id  : integer cluster label (0-based, assigned by KMeans)
-- cluster_label: human-readable tier name derived from cluster risk ranking

ALTER TABLE risk.scores
    ADD COLUMN IF NOT EXISTS cluster_id    SMALLINT,
    ADD COLUMN IF NOT EXISTS cluster_label TEXT;
