CREATE OR REPLACE FUNCTION sp_get_campaign_by_id(
    p_campaign_id UUID,
    p_user_id     UUID
)
RETURNS TABLE(
    id              UUID,
    business_id     UUID,
    user_id         UUID,
    campaign_name   TEXT,
    goal            TEXT,
    objective       TEXT,
    platforms       TEXT[],
    funnel_stage    TEXT,
    num_variants    INT,
    special_brief   TEXT,
    asset_formats   JSONB,
    status          TEXT,
    strategy_doc    JSONB,
    retry_count     INT,
    audit_score     FLOAT,
    error           TEXT,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id, c.business_id, c.user_id,
        c.campaign_name, c.goal,
        c.objective, c.platforms,
        c.funnel_stage, c.num_variants,
        c.special_brief, c.asset_formats,
        c.status, c.strategy_doc,
        c.retry_count, c.audit_score,
        c.error, c.created_at,
        c.updated_at, c.completed_at
    FROM campaigns c
    WHERE c.id = p_campaign_id
      AND c.user_id = p_user_id;
END;
$$;
