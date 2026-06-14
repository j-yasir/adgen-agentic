CREATE OR REPLACE FUNCTION sp_create_refresh_token(
    p_user_id    UUID,
    p_token_hash TEXT,
    p_expires_at TIMESTAMPTZ
)
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
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
    VALUES (p_user_id, p_token_hash, p_expires_at, FALSE)
    RETURNING
        refresh_tokens.id,
        refresh_tokens.user_id,
        refresh_tokens.token_hash,
        refresh_tokens.expires_at,
        refresh_tokens.revoked,
        refresh_tokens.created_at;
END;
$$;
