-- MIGRACIÓN DE COLUMNAS TIMESTAMP A TIMESTAMPTZ
-- Ejecutar en DBeaver o cliente PostgreSQL

-- Asumimos que el servidor está en UTC, por lo que los valores actuales
-- en las columnas TIMESTAMP (sin zona horaria) están guardados como hora UTC

-- Migrar sales.created_at
ALTER TABLE sales
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- Migrar users.created_at (si se muestra en alguna pantalla)
ALTER TABLE users
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- Migrar products.created_at (si se muestra en algún reporte)
ALTER TABLE products
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- Migrar products.updated_at (si se muestra en algún reporte)
ALTER TABLE products
ALTER COLUMN updated_at TYPE TIMESTAMPTZ
USING updated_at AT TIME ZONE 'UTC';

-- Migrar customers.created_at (si se muestra en alguna pantalla)
ALTER TABLE customers
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- Migrar customers.updated_at (si se muestra en alguna pantalla)
ALTER TABLE customers
ALTER COLUMN updated_at TYPE TIMESTAMPTZ
USING updated_at AT TIME ZONE 'UTC';

-- Migrar inventory_movements.created_at (si se muestra en algún reporte)
ALTER TABLE inventory_movements
ALTER COLUMN created_at TYPE TIMESTAMPTZ
USING created_at AT TIME ZONE 'UTC';

-- Verificar la migración
SELECT
    s.id,
    s.created_at,
    s.created_at AT TIME ZONE 'America/Bogota' as hora_local_colombia
FROM sales s
ORDER BY s.created_at DESC
LIMIT 5;
