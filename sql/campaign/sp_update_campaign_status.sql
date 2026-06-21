CREATE OR REPLACE FUNCTION sp_update_campaign_status(
    p_campaign_id   UUID,
    p_status        TEXT,
    p_strategy_doc  JSONB  DEFAULT NULL,
    p_audit_score   FLOAT  DEFAULT NULL,
    p_error         TEXT   DEFAULT NULL
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
    UPDATE campaigns SET
        status       = p_status,
        strategy_doc = COALESCE(p_strategy_doc, strategy_doc),
        audit_score  = COALESCE(p_audit_score,  audit_score),
        error        = COALESCE(p_error,         error),
        completed_at = CASE
                           WHEN p_status IN ('done', 'failed') THEN NOW()
                           ELSE completed_at
                       END,
        updated_at   = NOW()
    WHERE id = p_campaign_id
    RETURNING
        campaigns.id, campaigns.business_id, campaigns.user_id,
        campaigns.campaign_name, campaigns.goal,
        campaigns.objective, campaigns.platforms,
        campaigns.funnel_stage, campaigns.num_variants,
        campaigns.special_brief, campaigns.asset_formats,
        campaigns.status, campaigns.strategy_doc,
        campaigns.retry_count, campaigns.audit_score,
        campaigns.error, campaigns.created_at,
        campaigns.updated_at, campaigns.completed_at;
END;
$$;
