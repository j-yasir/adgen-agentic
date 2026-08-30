CREATE OR REPLACE FUNCTION sp_insert_business_event(
    p_business_id UUID,
    p_event_type  TEXT,
    p_agent       TEXT,
    p_payload     JSONB
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
DECLARE
    v_row business_events%ROWTYPE;
BEGIN
    INSERT INTO business_events (business_id, event_type, agent, payload)
    VALUES (p_business_id, p_event_type, p_agent, p_payload)
    RETURNING * INTO v_row;

    -- Same slim-envelope pattern as sp_insert_campaign_event: pg_notify is
    -- hard-capped at 8000 bytes and a full BKO exceeds it. Listeners re-read
    -- the full row from business_events by seq.
    PERFORM pg_notify(
        'business_' || p_business_id::TEXT,
        json_build_object(
            'id',         v_row.id,
            'seq',        v_row.seq,
            'event_type', v_row.event_type,
            'agent',      v_row.agent
        )::TEXT
    );

    RETURN QUERY
    SELECT
        v_row.id, v_row.business_id, v_row.seq,
        v_row.event_type, v_row.agent,
        v_row.payload, v_row.created_at;
END;
$$;
