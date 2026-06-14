CREATE OR REPLACE FUNCTION sp_get_refresh_token_by_hash(p_token_hash TEXT)
RETURNS TABLE(
    id          UUID,
    user_id     UUID,
    token_hash  TEXT,
    expires_at  TIMESTAMPTZ,
    revoked     BOOLEAN,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rt.id,
        rt.user_id,
        rt.token_hash,
        rt.expires_at,
        rt.revoked,
        rt.created_at
    FROM refresh_tokens rt
    WHERE rt.token_hash = p_token_hash;
END;
$$;
