CREATE OR REPLACE FUNCTION sp_set_primary_product_image(
    p_product_id UUID,
    p_image_id   UUID,
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
DECLARE
    v_owned BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM product_images pi
        JOIN products p ON p.id = pi.product_id
        JOIN businesses b ON b.id = p.business_id
        WHERE pi.id = p_image_id AND pi.product_id = p_product_id AND b.user_id = p_user_id
    ) INTO v_owned;

    IF NOT v_owned THEN
        RETURN;
    END IF;

    -- Single UPDATE sets exactly one row true and every other row for this
    -- product false in one atomic statement — no read-then-write race
    -- between two concurrent "set primary" calls.
    UPDATE product_images
    SET is_primary = (product_images.id = p_image_id)
    WHERE product_images.product_id = p_product_id;

    RETURN QUERY
    SELECT product_images.id, product_images.product_id, product_images.storage_url,
           product_images.is_primary, product_images.created_at
    FROM product_images
    WHERE product_images.id = p_image_id;
END;
$$;
