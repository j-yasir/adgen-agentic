CREATE OR REPLACE FUNCTION sp_list_products_with_images_by_business(
    p_business_id UUID,
    p_user_id     UUID
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
    updated_at             TIMESTAMPTZ,
    images                 JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- One query, images pre-aggregated via jsonb_agg — avoids an N+1 query
    -- pattern since this runs on every business fetch (see
    -- business_service.assemble_products_into_bko).
    RETURN QUERY
    SELECT
        p.id, p.business_id, p.name, p.type, p.is_hero, p.description,
        p.key_features, p.benefits, p.pricing_model, p.pricing_tier,
        p.pricing_details, p.unique_selling_points, p.target_use_case,
        p.created_at, p.updated_at,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pi.id, 'product_id', pi.product_id,
                    'storage_url', pi.storage_url, 'is_primary', pi.is_primary,
                    'created_at', pi.created_at
                ) ORDER BY pi.is_primary DESC, pi.created_at ASC
             ) FROM product_images pi WHERE pi.product_id = p.id),
            '[]'::jsonb
        ) AS images
    FROM products p
    JOIN businesses b ON b.id = p.business_id
    WHERE p.business_id = p_business_id AND b.user_id = p_user_id
    ORDER BY p.is_hero DESC, p.created_at ASC;
END;
$$;
