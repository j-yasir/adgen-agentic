CREATE OR REPLACE FUNCTION sp_create_business(
    p_user_id           UUID,
    p_name              TEXT,
    p_website           TEXT,
    p_industry          TEXT,
    p_bko               JSONB,
    p_onboarding_path   TEXT,
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
    INSERT INTO businesses (user_id, name, website, industry, bko, bko_version, onboarding_path, onboarding_status)
    VALUES (p_user_id, p_name, p_website, p_industry, p_bko, 1, p_onboarding_path, p_onboarding_status)
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
