CREATE OR REPLACE FUNCTION sp_get_product_by_id(
    p_product_id UUID,
    p_user_id    UUID
)
RETURNS TABLE(
    id                     UUID,
    business_id            UUID,
    name                   TEXT,
    type                   TEXT,
    is_hero                BOOLEAN,
    description            TEXT,
    key_features           TEXT[],
    benefits               TEXT[],
    pricing_model          TEXT,
    pricing_tier           TEXT,
    pricing_details        TEXT,
    unique_selling_points  TEXT[],
    target_use_case        TEXT,
    created_at             TIMESTAMPTZ,
    updated_at             TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id, p.business_id, p.name, p.type, p.is_hero, p.description,
        p.key_features, p.benefits, p.pricing_model, p.pricing_tier,
        p.pricing_details, p.unique_selling_points, p.target_use_case,
        p.created_at, p.updated_at
    FROM products p
    JOIN businesses b ON b.id = p.business_id
    WHERE p.id = p_product_id AND b.user_id = p_user_id;
END;
$$;
