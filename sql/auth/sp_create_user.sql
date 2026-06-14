CREATE OR REPLACE FUNCTION sp_create_user(
    p_name          TEXT,
    p_email         TEXT,
    p_password_hash TEXT
)
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
    INSERT INTO users (name, email, password_hash)
    VALUES (p_name, p_email, p_password_hash)
    RETURNING
        users.id,
        users.email,
        users.name,
        users.password_hash,
        users.created_at,
        users.updated_at;
END;
$$;
