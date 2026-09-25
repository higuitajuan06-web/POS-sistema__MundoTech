-- MIGRACIÓN: congelar la comisión aplicada en cada línea de venta
ALTER TABLE sale_items
ADD COLUMN commission_percentage NUMERIC(5,2) DEFAULT 0;
