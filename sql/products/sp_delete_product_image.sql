CREATE OR REPLACE FUNCTION sp_delete_product_image(
    p_product_id UUID,
    p_image_id   UUID,
    p_user_id    UUID
)
RETURNS TABLE(storage_url TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_was_primary   BOOLEAN;
    v_storage_url   TEXT;
    v_deleted       INT;
    v_next_image_id UUID;
BEGIN
    -- p_product_id is required, not just p_image_id — guards against a
    -- mismatched {product_id}/images/{image_id} URL pair (same business,
    -- different product) silently acting on the wrong product's image.
    DELETE FROM product_images
    USING products p, businesses b
    WHERE product_images.id = p_image_id
      AND product_images.product_id = p_product_id
      AND product_images.product_id = p.id
      AND p.business_id = b.id
      AND b.user_id = p_user_id
    RETURNING product_images.is_primary, product_images.storage_url
    INTO v_was_primary, v_storage_url;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    IF v_deleted = 0 THEN
        RETURN;
    END IF;

    -- Deleting the primary image auto-promotes the oldest remaining image —
    -- symmetric with "first upload auto-becomes primary" in sp_add_product_image.
    IF v_was_primary THEN
        SELECT product_images.id INTO v_next_image_id
        FROM product_images
        WHERE product_images.product_id = p_product_id
        ORDER BY product_images.created_at ASC
        LIMIT 1;

        IF v_next_image_id IS NOT NULL THEN
            UPDATE product_images
            SET is_primary = TRUE
            WHERE product_images.id = v_next_image_id;
        END IF;
    END IF;

    RETURN QUERY SELECT v_storage_url;
END;
$$;
