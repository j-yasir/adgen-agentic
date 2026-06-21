CREATE OR REPLACE FUNCTION sp_create_campaign(
    p_user_id       UUID,
    p_business_id   UUID,
    p_campaign_name TEXT,
    p_objective     TEXT,
    p_platforms     TEXT[],
    p_funnel_stage  TEXT,
    p_num_variants  INT,
    p_special_brief TEXT
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
DECLARE
    v_goal TEXT;
BEGIN
    -- Auto-generate goal label if name not provided
    v_goal := COALESCE(
        p_campaign_name,
        INITCAP(p_objective) || ' campaign — ' || ARRAY_TO_STRING(p_platforms, ', ')
    );

    RETURN QUERY
    INSERT INTO campaigns (
        user_id, business_id, campaign_name, goal,
        objective, platforms, funnel_stage, num_variants,
        special_brief, asset_formats, status, retry_count
    )
    VALUES (
        p_user_id, p_business_id,
        p_campaign_name,
        v_goal,
        p_objective, p_platforms, p_funnel_stage, p_num_variants,
        p_special_brief, '{}', 'pending', 0
    )
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
