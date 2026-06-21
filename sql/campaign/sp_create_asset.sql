CREATE OR REPLACE FUNCTION sp_create_asset(
    p_campaign_id UUID,
    p_platform    TEXT,
    p_format      TEXT,
    p_asset_type  TEXT,
    p_storage_url TEXT,
    p_prompt_used TEXT
)
RETURNS TABLE(
    id          UUID,
    campaign_id UUID,
    platform    TEXT,
    format      TEXT,
    asset_type  TEXT,
    storage_url TEXT,
    prompt_used TEXT,
    status      TEXT,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO assets (campaign_id, platform, format, asset_type, storage_url, prompt_used, status)
    VALUES (p_campaign_id, p_platform, p_format, p_asset_type, p_storage_url, p_prompt_used, 'stored')
    RETURNING
        assets.id, assets.campaign_id, assets.platform,
        assets.format, assets.asset_type, assets.storage_url,
        assets.prompt_used, assets.status, assets.created_at;
END;
$$;
