CREATE OR REPLACE FUNCTION sp_delete_product(
    p_product_id UUID,
    p_user_id    UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INT;
BEGIN
    -- product_images rows cascade automatically via their FK's
    -- ON DELETE CASCADE — no explicit cleanup needed here.
    DELETE FROM products
    USING businesses b
    WHERE products.id = p_product_id
      AND products.business_id = b.id
      AND b.user_id = p_user_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$;
