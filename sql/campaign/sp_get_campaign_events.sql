CREATE OR REPLACE FUNCTION sp_get_campaign_events(
    p_campaign_id UUID,
    p_after_seq   BIGINT DEFAULT 0
)
RETURNS TABLE(
    id          UUID,
    campaign_id UUID,
    seq         BIGINT,
    event_type  TEXT,
    agent       TEXT,
    payload     JSONB,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id, e.campaign_id, e.seq,
        e.event_type, e.agent,
        e.payload, e.created_at
    FROM campaign_events e
    WHERE e.campaign_id = p_campaign_id
      AND e.seq > p_after_seq
    ORDER BY e.seq ASC;
END;
$$;
