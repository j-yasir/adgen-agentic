CREATE OR REPLACE FUNCTION sp_finalize_business(
    p_business_id UUID,
    p_user_id     UUID,
    p_name        TEXT,
    p_website     TEXT,
    p_industry    TEXT,
    p_bko         JSONB
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
    -- Used once, at the end of URL-based onboarding: unlike
    -- sp_update_business_bko (which only ever touches bko/status for the
    -- PATCH/asset-upload paths), this also refreshes the denormalised
    -- name/website/industry columns from what the agent actually discovered
    -- — a "pending" placeholder row's name is a domain-derived guess, and
    -- the list view reads these columns directly rather than bko.identity.
    RETURN QUERY
    UPDATE businesses
    SET
        name              = p_name,
        website           = p_website,
        industry          = p_industry,
        bko               = p_bko,
        bko_version       = businesses.bko_version + 1,
        onboarding_status = 'complete',
        updated_at        = NOW()
    WHERE businesses.id = p_business_id
      AND businesses.user_id = p_user_id
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
