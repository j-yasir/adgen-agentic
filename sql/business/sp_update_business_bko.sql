CREATE OR REPLACE FUNCTION sp_update_business_bko(
    p_business_id       UUID,
    p_user_id           UUID,
    p_bko               JSONB,
    p_onboarding_status TEXT
)
RETURNS TABLE(
    id                UUID,
    user_id           UUID,
    name              TEXT,
    website           TEXT,
    industry          TEXT,
    bko               JSONB,
    bko_version       INT,
    onboarding_path   TEXT,
    onboarding_status TEXT,
    created_at        TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE businesses
    SET
        bko               = p_bko,
        bko_version       = bko_version + 1,
        onboarding_status = p_onboarding_status,
        updated_at        = NOW()
    WHERE id = p_business_id
      AND user_id = p_user_id
    RETURNING
        businesses.id,
        businesses.user_id,
        businesses.name,
        businesses.website,
        businesses.industry,
        businesses.bko,
        businesses.bko_version,
        businesses.onboarding_path,
        businesses.onboarding_status,
        businesses.created_at,
        businesses.updated_at;
END;
$$;
