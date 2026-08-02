CREATE OR REPLACE FUNCTION sp_list_product_images(
    p_product_id UUID,
    p_user_id    UUID
)
RETURNS TABLE(
    id          UUID,
    product_id  UUID,
    storage_url TEXT,
    is_primary  BOOLEAN,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT pi.id, pi.product_id, pi.storage_url, pi.is_primary, pi.created_at
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    JOIN businesses b ON b.id = p.business_id
    WHERE pi.product_id = p_product_id AND b.user_id = p_user_id
    ORDER BY pi.is_primary DESC, pi.created_at ASC;
END;
$$;
