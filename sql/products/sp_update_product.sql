CREATE OR REPLACE FUNCTION sp_update_product(
    p_product_id            UUID,
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
    -- Every column reference qualified with `products.` on both sides of
    -- COALESCE — unqualified names here would be ambiguous against the
    -- RETURNS TABLE column names of the same name (the exact bug class
    -- fixed in sp_update_business_bko.sql / sp_update_asset_status.sql).
    -- NULL means "don't change this field" (same convention already used
    -- in sp_update_campaign_status.sql) — there is no way to explicitly
    -- null out pricing_details/target_use_case via this proc.
    RETURN QUERY
    UPDATE products SET
        name                  = COALESCE(p_name, products.name),
        type                  = COALESCE(p_type, products.type),
        is_hero               = COALESCE(p_is_hero, products.is_hero),
        description           = COALESCE(p_description, products.description),
        key_features          = COALESCE(p_key_features, products.key_features),
        benefits              = COALESCE(p_benefits, products.benefits),
        pricing_model         = COALESCE(p_pricing_model, products.pricing_model),
        pricing_tier          = COALESCE(p_pricing_tier, products.pricing_tier),
        pricing_details       = COALESCE(p_pricing_details, products.pricing_details),
        unique_selling_points = COALESCE(p_unique_selling_points, products.unique_selling_points),
        target_use_case       = COALESCE(p_target_use_case, products.target_use_case),
        updated_at            = NOW()
    WHERE products.id = p_product_id
      AND EXISTS (
          SELECT 1 FROM businesses b
          WHERE b.id = products.business_id AND b.user_id = p_user_id
      )
    RETURNING
        products.id, products.business_id, products.name, products.type, products.is_hero,
        products.description, products.key_features, products.benefits,
        products.pricing_model, products.pricing_tier, products.pricing_details,
        products.unique_selling_points, products.target_use_case,
        products.created_at, products.updated_at;
END;
$$;
