CREATE OR REPLACE FUNCTION sp_revoke_all_user_tokens(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE refresh_tokens
    SET revoked = TRUE
    WHERE user_id = p_user_id
      AND revoked = FALSE;
END;
$$;
