-- MIGRACIÓN: comisión independiente por producto
ALTER TABLE products
ADD COLUMN commission_percentage NUMERIC(5,2) DEFAULT 0;
