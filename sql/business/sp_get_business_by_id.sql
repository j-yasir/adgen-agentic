CREATE OR REPLACE FUNCTION sp_get_business_by_id(
    p_business_id UUID,
    p_user_id     UUID
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
    SELECT
        b.id,
        b.user_id,
        b.name,
        b.website,
        b.industry,
        b.bko,
        b.bko_version,
        b.onboarding_path,
        b.onboarding_status,
        b.created_at,
        b.updated_at
    FROM businesses b
    WHERE b.id = p_business_id
      AND b.user_id = p_user_id;
END;
$$;
