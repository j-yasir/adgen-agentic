CREATE OR REPLACE FUNCTION sp_revoke_refresh_token(p_token_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE refresh_tokens
    SET revoked = TRUE
    WHERE token_hash = p_token_hash;
END;
$$;
