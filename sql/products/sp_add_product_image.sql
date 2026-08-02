CREATE OR REPLACE FUNCTION sp_add_product_image(
    p_product_id  UUID,
    p_user_id     UUID,
    p_storage_url TEXT
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
DECLARE
    v_is_first BOOLEAN;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM products p
        JOIN businesses b ON b.id = p.business_id
        WHERE p.id = p_product_id AND b.user_id = p_user_id
    ) THEN
        RETURN;  -- empty result => repo returns None => service raises NotFoundError
    END IF;

    -- First image uploaded for a product auto-becomes primary.
    v_is_first := NOT EXISTS (
        SELECT 1 FROM product_images pi WHERE pi.product_id = p_product_id
    );

    RETURN QUERY
    INSERT INTO product_images (product_id, storage_url, is_primary)
    VALUES (p_product_id, p_storage_url, v_is_first)
    RETURNING
        product_images.id, product_images.product_id, product_images.storage_url,
        product_images.is_primary, product_images.created_at;
END;
$$;
