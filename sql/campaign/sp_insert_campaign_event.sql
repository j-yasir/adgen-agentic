CREATE OR REPLACE FUNCTION sp_insert_campaign_event(
    p_campaign_id UUID,
    p_event_type  TEXT,
    p_agent       TEXT,
    p_payload     JSONB
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
DECLARE
    v_row campaign_events%ROWTYPE;
BEGIN
    INSERT INTO campaign_events (campaign_id, event_type, agent, payload)
    VALUES (p_campaign_id, p_event_type, p_agent, p_payload)
    RETURNING * INTO v_row;

    -- Notify SSE listeners on channel 'campaign_{id}'
    PERFORM pg_notify(
        'campaign_' || p_campaign_id::TEXT,
        json_build_object(
            'id',          v_row.id,
            'campaign_id', v_row.campaign_id,
            'seq',         v_row.seq,
            'event_type',  v_row.event_type,
            'agent',       v_row.agent,
            'payload',     v_row.payload,
            'created_at',  v_row.created_at
        )::TEXT
    );

    RETURN QUERY
    SELECT
        v_row.id, v_row.campaign_id, v_row.seq,
        v_row.event_type, v_row.agent,
        v_row.payload, v_row.created_at;
END;
$$;
