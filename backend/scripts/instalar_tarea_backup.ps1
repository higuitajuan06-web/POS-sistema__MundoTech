# Script de instalación de tarea programada de Windows para backup automático
# POS Mundo Tech - Backup PostgreSQL
# Ejecutar este script UNA VEZ durante la instalación del sistema

# Requires -RunAsAdministrator

Write-Host "🔧 Configurando tarea programada de backup automático para POS Mundo Tech..." -ForegroundColor Cyan

# Obtener la ruta del proyecto
$scriptPath = $PSScriptRoot
$projectRoot = Split-Path -Path $scriptPath -Parent
$backupScript = Join-Path -Path $scriptPath -ChildPath "backup_db.py"

# Verificar que el script de backup existe
if (-not (Test-Path $backupScript)) {
    Write-Host "❌ ERROR: No se encontró el script backup_db.py en $backupScript" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Script de backup encontrado: $backupScript" -ForegroundColor Green

# Configuración de la tarea programada
$taskName = "Backup_POS_MundoTech"
$taskDescription = "Backup automático de base de datos PostgreSQL para POS Mundo Tech"
$pythonExe = "python"  # Asumimos que python está en el PATH

# Ruta completa al script de Python
$pythonScript = $backupScript

# Argumentos para Python
$pythonArgs = "`"$pythonScript`""

# Configurar horario: todos los días a las 11:00 PM
$trigger = New-ScheduledTaskTrigger -Daily -At "23:00"

# Configurar acción: ejecutar script de Python
$action = New-ScheduledTaskAction -Execute $pythonExe -Argument $pythonArgs -WorkingDirectory $scriptPath

# Configurar principal: ejecutar con cuenta del sistema
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Configurar configuración de la tarea
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)

# Intentar eliminar la tarea si ya existe
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "⚠️  La tarea ya existe, eliminándola..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "✅ Tarea anterior eliminada" -ForegroundColor Green
}

# Registrar la nueva tarea programada
Register-ScheduledTask -TaskName $taskName -Description $taskDescription -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "✅ Tarea programada creada exitosamente" -ForegroundColor Green
Write-Host "📅 Nombre de la tarea: $taskName" -ForegroundColor White
Write-Host "⏰ Horario: Todos los días a las 11:00 PM" -ForegroundColor White
Write-Host "📁 Script: $backupScript" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "🔍 Para verificar la tarea, abre el Programador de tareas de Windows y busca '$taskName'" -ForegroundColor Cyan
Write-Host "🧪 Para probar manualmente: python `"$backupScript`"" -ForegroundColor Cyan

Write-Host "" -ForegroundColor White
Write-Host "🎉 Instalación completada. El backup se ejecutará automáticamente todos los días a las 11:00 PM" -ForegroundColor Green