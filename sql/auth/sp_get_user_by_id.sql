CREATE OR REPLACE FUNCTION sp_get_user_by_id(p_user_id UUID)
RETURNS TABLE(
    id            UUID,
    email         TEXT,
    name          TEXT,
    password_hash TEXT,
    created_at    TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.email,
        u.name,
        u.password_hash,
        u.created_at,
        u.updated_at
    FROM users u
    WHERE u.id = p_user_id;
END;
$$;
