CREATE OR REPLACE FUNCTION sp_get_business_events(
    p_business_id UUID,
    p_after_seq   BIGINT DEFAULT 0
)
RETURNS TABLE(
    id          UUID,
    business_id UUID,
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
        e.id, e.business_id, e.seq,
        e.event_type, e.agent,
        e.payload, e.created_at
    FROM business_events e
    WHERE e.business_id = p_business_id
      AND e.seq > p_after_seq
    ORDER BY e.seq ASC;
END;
$$;
