CREATE TABLE gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    image_url VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES categories(id),
    product_id UUID REFERENCES products(id),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gallery_category ON gallery_items(category_id);
