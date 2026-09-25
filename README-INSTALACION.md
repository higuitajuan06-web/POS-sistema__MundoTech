# Instrucciones de Instalación - Mundo Tech POS

## Requisitos Previos

1. **Windows 10 o superior**
2. **PostgreSQL** instalado en el sistema
3. **Python 3.13** (no requerido para el .exe, pero sí para desarrollo)

## Archivos de Configuración (Excluidos del .exe)

Estos archivos deben estar en la misma carpeta que el ejecutable `MundoTech-POS.exe`:

### 1. `.env` (Credenciales de base de datos)
Copie el archivo `.env.example` y renómbrelo a `.env`, luego configure:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pos_sistema
DB_USER=postgres
DB_PASSWORD=tu_password_aqui
SECRET_KEY=clave-temporal-cambiar-en-produccion
PG_DUMP_PATH=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
BACKUP_USB_PATH=
DEBUG=False
```

**Importante:**
- Cada instalación tiene sus propias credenciales de base de datos
- El archivo `.env` **NO** está incluido en el .exe por seguridad
- Ajuste `PG_DUMP_PATH` según su instalación de PostgreSQL

### 2. `license.json` (Licencia del cliente)
Cada cliente tiene su propio archivo de licencia proporcionado por Mundo Tech.

**El archivo `license.json` debe estar junto al .exe y no puede compartirse entre instalaciones.**

### 3. Carpeta `backups` (Backups de base de datos)
El sistema generará automáticamente backups en esta carpeta.
- Se crea automáticamente al ejecutar el .exe
- Contiene archivos `.sql` con los backups
- Se puede mover o copiar manualmente para seguridad adicional

## Instalación

1. **Copie el archivo `MundoTech-POS.exe`** a la carpeta donde desea instalar el sistema
2. **Copie el archivo `.env`** con las credenciales de su base de datos
3. **Copie el archivo `license.json`** proporcionado por Mundo Tech
4. **Ejecute `MundoTech-POS.exe`** (doble clic)

## Verificación de Instalación

1. Debería abrirse una ventana de escritorio con la pantalla de login
2. No debería aparecer ninguna consola negra
3. Si la licencia es válida, verá el formulario de login
4. Si la licencia es inválida, verá la pantalla de bloqueo

## Solución de Problemas

### El .exe no abre
- Verifique que `.env` y `license.json` estén en la misma carpeta
- Verifique que PostgreSQL esté instalado y corriendo
- Verifique las credenciales en `.env`

### Error de conexión a base de datos
- Verifique que PostgreSQL esté ejecutándose
- Verifique las credenciales en `.env`
- Verifique que la base de datos `pos_sistema` exista

### Licencia inválida
- Contacte a Mundo Tech para renovar la licencia
- Verifique que el archivo `license.json` no haya sido modificado
- Verifique que la fecha del sistema sea correcta

## Backups Automáticos

El sistema genera backups automáticos en la carpeta `backups`:
- Backups locales: `backups/backup_pos_sistema_YYYY-MM-DD_HH-MM-SS.sql`
- Backups USB: Si está configurado `BACKUP_USB_PATH` en `.env`
- Limpieza automática: Se eliminan backups locales de más de 15 días

## Actualización del Sistema

Para actualizar a una nueva versión:
1. Cierre completamente el .exe
2. Reemplace `MundoTech-POS.exe` con la nueva versión
3. Mantenga `.env`, `license.json` y la carpeta `backups`
4. Ejecute la nueva versión

## Soporte Técnico

Para problemas técnicos, contacte a:
- **Mundo Tech**
- Soporte POS: [información de contacto]