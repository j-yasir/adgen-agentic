CREATE OR REPLACE FUNCTION sp_create_product(
    p_business_id           UUID,
    p_user_id               UUID,
    p_name                  TEXT,
    p_type                  TEXT,
    p_is_hero               BOOLEAN,
    p_description           TEXT,
    p_key_features          TEXT[],
    p_benefits              TEXT[],
    p_pricing_model         TEXT,
    p_pricing_tier          TEXT,
    p_pricing_details       TEXT,
    p_unique_selling_points TEXT[],
    p_target_use_case       TEXT
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
    -- Ownership enforced in SQL: the INSERT ... SELECT only produces a row
    -- (and therefore only inserts) if p_business_id belongs to p_user_id.
    RETURN QUERY
    INSERT INTO products (
        business_id, name, type, is_hero, description, key_features, benefits,
        pricing_model, pricing_tier, pricing_details, unique_selling_points, target_use_case
    )
    SELECT
        p_business_id, p_name, p_type, p_is_hero, p_description, p_key_features, p_benefits,
        p_pricing_model, p_pricing_tier, p_pricing_details, p_unique_selling_points, p_target_use_case
    WHERE EXISTS (
        SELECT 1 FROM businesses b WHERE b.id = p_business_id AND b.user_id = p_user_id
    )
    RETURNING
        products.id, products.business_id, products.name, products.type, products.is_hero,
        products.description, products.key_features, products.benefits,
        products.pricing_model, products.pricing_tier, products.pricing_details,
        products.unique_selling_points, products.target_use_case,
        products.created_at, products.updated_at;
END;
$$;
