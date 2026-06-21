CREATE OR REPLACE FUNCTION sp_update_asset_status(
    p_asset_id UUID,
    p_status   TEXT
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
    UPDATE assets SET status = p_status
    WHERE id = p_asset_id
    RETURNING
        assets.id, assets.campaign_id, assets.platform,
        assets.format, assets.asset_type, assets.storage_url,
        assets.prompt_used, assets.status, assets.created_at;
END;
$$;
