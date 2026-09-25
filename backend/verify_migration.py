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

with conn.cursor() as cur:
    cur.execute('SELECT id, created_at, created_at AT TIME ZONE \'America/Bogota\' as hora_local FROM sales ORDER BY created_at DESC LIMIT 1;')
    resultado = cur.fetchone()
    if resultado:
        print('Última venta registrada:')
        print(f'ID: {resultado[0]}')
        print(f'created_at (con offset): {resultado[1]}')
        print(f'hora local Colombia: {resultado[2]}')
    else:
        print('No hay ventas')

conn.close()
