import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

conn = psycopg.connect(
    host=os.getenv('DB_HOST'),
    port=os.getenv('DB_PORT'),
    dbname=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)

try:
    with conn.cursor() as cur:
        print('=== INICIANDO MIGRACIÓN A TIMESTAMPTZ ===')
        print()

        # Migrar sales.created_at
        print('Migrando sales.created_at...')
        cur.execute("""
            ALTER TABLE sales
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'UTC';
        """)
        print('✓ sales.created_at migrado')

        # Migrar users.created_at
        print('Migrando users.created_at...')
        cur.execute("""
            ALTER TABLE users
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'UTC';
        """)
        print('✓ users.created_at migrado')

        # Migrar products.created_at
        print('Migrando products.created_at...')
        cur.execute("""
            ALTER TABLE products
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'UTC';
        """)
        print('✓ products.created_at migrado')

        # Migrar products.updated_at
        print('Migrando products.updated_at...')
        cur.execute("""
            ALTER TABLE products
            ALTER COLUMN updated_at TYPE TIMESTAMPTZ
            USING updated_at AT TIME ZONE 'UTC';
        """)
        print('✓ products.updated_at migrado')

        # Migrar customers.created_at
        print('Migrando customers.created_at...')
        cur.execute("""
            ALTER TABLE customers
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'UTC';
        """)
        print('✓ customers.created_at migrado')

        # Migrar customers.updated_at
        print('Migrando customers.updated_at...')
        cur.execute("""
            ALTER TABLE customers
            ALTER COLUMN updated_at TYPE TIMESTAMPTZ
            USING updated_at AT TIME ZONE 'UTC';
        """)
        print('✓ customers.updated_at migrado')

        # Migrar inventory_movements.created_at
        print('Migrando inventory_movements.created_at...')
        cur.execute("""
            ALTER TABLE inventory_movements
            ALTER COLUMN created_at TYPE TIMESTAMPTZ
            USING created_at AT TIME ZONE 'UTC';
        """)
        print('✓ inventory_movements.created_at migrado')

        conn.commit()
        print()
        print('=== MIGRACIÓN COMPLETADA ===')

        # Verificar la migración
        print()
        print('=== VERIFICACIÓN DE SALES ===')
        cur.execute("""
            SELECT
                s.id,
                s.created_at,
                s.created_at AT TIME ZONE 'America/Bogota' as hora_local_colombia
            FROM sales s
            ORDER BY s.created_at DESC
            LIMIT 5;
        """)
        resultados = cur.fetchall()
        for row in resultados:
            print(f"ID: {row[0]}, created_at (UTC): {row[1]}, hora local Colombia: {row[2]}")

except Exception as e:
    conn.rollback()
    print(f'❌ Error durante la migración: {e}')
finally:
    conn.close()
