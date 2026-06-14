CREATE OR REPLACE FUNCTION sp_delete_business(
    p_business_id UUID,
    p_user_id     UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM businesses
    WHERE id = p_business_id
      AND user_id = p_user_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$;
