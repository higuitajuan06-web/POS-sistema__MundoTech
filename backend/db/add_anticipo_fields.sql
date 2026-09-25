-- MIGRACIÓN: Agregar campos de anticipo y teléfono a appointments, vincular sales con appointments
-- Ejecutar en DBeaver o cliente PostgreSQL

-- PASO 1: Agregar campos de anticipo a appointments
ALTER TABLE appointments
ADD COLUMN anticipo_monto NUMERIC(12,2) DEFAULT 0;

ALTER TABLE appointments
ADD COLUMN anticipo_payment_method_id UUID
REFERENCES payment_methods(id);

-- PASO 2: Agregar campo de teléfono específico para la cita
ALTER TABLE appointments
ADD COLUMN phone VARCHAR(20);

-- PASO 3: Agregar campo para vincular ventas con citas
ALTER TABLE sales
ADD COLUMN appointment_id UUID
REFERENCES appointments(id);

-- Verificar la migración
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name IN ('appointments', 'sales')
ORDER BY table_name, ordinal_position;
