"""
Script de backup automático para PostgreSQL - POS Mundo Tech
Ejecuta pg_dump para generar backups locales y opcionales en USB
"""
import os
import subprocess
import shutil
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

def main():
    # Configuración desde variables de entorno
    pg_dump_path = os.getenv("PG_DUMP_PATH")
    backup_usb_path = os.getenv("BACKUP_USB_PATH")
    
    # Configuración de la base de datos
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    
    # Directorio de backups locales
    backup_dir = Path(__file__).parent.parent / "backups"
    backup_dir.mkdir(exist_ok=True)
    
    # Archivo de log
    log_file = backup_dir / "backup.log"
    
    # Generar nombre de archivo con fecha y hora
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"backup_pos_sistema_{timestamp}.sql"
    backup_file_path = backup_dir / backup_filename
    
    # Validar configuración esencial
    if not all([pg_dump_path, db_name, db_user, db_password]):
        error_msg = "❌ ERROR: Faltan variables de entorno esenciales (PG_DUMP_PATH, DB_NAME, DB_USER, DB_PASSWORD)"
        log_result(log_file, "ERROR", error_msg, 0)
        print(error_msg)
        return
    
    if not Path(pg_dump_path).exists():
        error_msg = f"❌ ERROR: pg_dump no encontrado en {pg_dump_path}"
        log_result(log_file, "ERROR", error_msg, 0)
        print(error_msg)
        return
    
    print(f"🔄 Iniciando backup de PostgreSQL: {db_name}")
    print(f"📁 Ruta local: {backup_file_path}")
    
    try:
        # Construir comando pg_dump
        pg_dump_cmd = [
            pg_dump_path,
            f"--host={db_host}",
            f"--port={db_port}",
            f"--dbname={db_name}",
            f"--username={db_user}",
            "--no-password",  # Usar PGPASSWORD para evitar prompt interactivo
            "--format=plain",
            "--no-owner",
            "--no-acl",
            "--verbose"
        ]
        
        # Configurar variable de entorno para la contraseña
        env = os.environ.copy()
        env["PGPASSWORD"] = db_password
        
        # Ejecutar pg_dump y redirigir salida al archivo
        print(f"📦 Ejecutando pg_dump...")
        result = subprocess.run(
            pg_dump_cmd,
            stdout=open(backup_file_path, "w", encoding="utf-8"),
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        
        if result.returncode != 0:
            error_msg = f"❌ ERROR: pg_dump falló con código {result.returncode}"
            log_result(log_file, "ERROR", error_msg, 0)
            print(error_msg)
            print(f"Detalle del error: {result.stderr}")
            return
        
        # Obtener tamaño del archivo generado
        file_size = backup_file_path.stat().st_size
        file_size_mb = file_size / (1024 * 1024)
        
        print(f"✅ Backup local generado exitosamente: {backup_filename}")
        print(f"📊 Tamaño: {file_size_mb:.2f} MB")
        
        # Intentar copiar a USB si está configurada
        usb_copied = False
        if backup_usb_path:
            usb_path = Path(backup_usb_path)
            if usb_path.exists():
                try:
                    usb_backup_path = usb_path / backup_filename
                    shutil.copy2(backup_file_path, usb_backup_path)
                    print(f"✅ Copia USB creada: {usb_backup_path}")
                    usb_copied = True
                except Exception as e:
                    warning_msg = f"⚠️  ADVERTENCIA: No se pudo copiar a USB: {e}"
                    print(warning_msg)
                    log_result(log_file, "WARNING", warning_msg, file_size)
            else:
                warning_msg = f"⚠️  ADVERTENCIA: USB de backup no encontrada en {backup_usb_path}, solo se guardó copia local"
                print(warning_msg)
                log_result(log_file, "WARNING", warning_msg, file_size)
        
        # Limpiar backups locales antiguos (más de 15 días)
        cleaned_count = clean_old_backups(backup_dir, days=15)
        if cleaned_count > 0:
            print(f"🧹 Limpiados {cleaned_count} backups locales antiguos (más de 15 días)")
        
        # Registrar éxito en log
        status_msg = f"Backup exitoso. Local: {backup_filename}"
        if usb_copied:
            status_msg += f" | USB: {backup_usb_path}"
        log_result(log_file, "SUCCESS", status_msg, file_size)
        
        print(f"📝 Backup completado y registrado en {log_file}")
        
    except Exception as e:
        error_msg = f"❌ ERROR INESPERADO: {e}"
        log_result(log_file, "ERROR", error_msg, 0)
        print(error_msg)


def clean_old_backups(backup_dir, days=15):
    """Elimina backups locales más antiguos que el número de días especificado"""
    from datetime import timedelta
    
    cutoff_date = datetime.now() - timedelta(days=days)
    cleaned_count = 0
    
    for backup_file in backup_dir.glob("backup_pos_sistema_*.sql"):
        # Obtener fecha de modificación del archivo
        file_mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)
        
        if file_mtime < cutoff_date:
            try:
                backup_file.unlink()
                cleaned_count += 1
                print(f"   🗑️  Eliminado: {backup_file.name}")
            except Exception as e:
                print(f"   ⚠️  No se pudo eliminar {backup_file.name}: {e}")
    
    return cleaned_count


def log_result(log_file, status, message, file_size):
    """Registra el resultado del backup en el archivo de log"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    file_size_mb = file_size / (1024 * 1024) if file_size > 0 else 0
    
    log_entry = f"[{timestamp}] [{status}] {message} | Tamaño: {file_size_mb:.2f} MB\n"
    
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"⚠️  No se pudo escribir en el log: {e}")


if __name__ == "__main__":
    main()