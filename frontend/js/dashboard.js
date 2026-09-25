// Dashboard - Métricas financieras para el administrador
let grafica7Dias = null;

// ===== Inicio =====
async function iniciar() {
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    window.location.href = "login.html";
    return;
  }

  // Configurar botón de actualizaciones (solo para ADMIN)
  configurarBotonActualizaciones(sesion);

  // NOTA: La verificación de rol y configuración del sidebar se manejan en sidebar.js
  // No es necesario configurarlos aquí

  try {
    const fechaHoy = obtenerFechaLocal();
    const [dashboard, citasHoyResultado, anticiposResultado, bodegaResultado] = await Promise.all([
      obtenerDashboard(),
      obtenerCitas({ date: fechaHoy })
        .then(datos => ({ datos }))
        .catch(error => ({ error })),
      obtenerCitas({ con_anticipo: true })
        .then(datos => ({ datos }))
        .catch(error => ({ error })),
      obtenerBodega()
        .then(datos => ({ datos }))
        .catch(error => ({ error }))
    ]);
    renderizarResumen(dashboard);
    renderizarGrafica(dashboard.ultimos_7_dias);
    renderizarProductoMasVendido(dashboard.producto_mas_vendido);
    renderizarWidgetResultado(citasHoyResultado, renderizarCitasHoy, "citas-hoy-lista", "citas-hoy-contador");
    renderizarWidgetResultado(anticiposResultado, renderizarAnticipos, "anticipos-lista", "anticipos-contador");
    renderizarWidgetResultado(bodegaResultado, renderizarStockBajo, "stock-bajo-lista", "stock-bajo-contador");
  } catch (error) {
    console.error("Error al cargar dashboard:", error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo cargar el dashboard: ${error.message}`
    });
  }

  function renderizarWidgetResultado(resultado, renderizador, listaId, contadorId) {
    if (!resultado.error) {
      renderizador(resultado.datos);
      return;
    }

    console.error("Error al cargar widget del dashboard:", resultado.error);
    document.getElementById(contadorId).textContent = "No disponible";
    const lista = document.getElementById(listaId);
    lista.replaceChildren();
    mostrarWidgetVacio(lista, "No se pudo cargar este dato");
  }

  function obtenerFechaLocal() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return `${hoy.getFullYear()}-${mes}-${dia}`;
  }

  function renderizarCitasHoy(citas) {
    const contador = document.getElementById("citas-hoy-contador");
    const lista = document.getElementById("citas-hoy-lista");
    const pendientes = citas.filter(cita => cita.status === "PENDIENTE").length;
    const confirmadas = citas.filter(cita => cita.status === "CONFIRMADA").length;
    contador.textContent = `${pendientes} pendientes, ${confirmadas} confirmadas`;
    lista.replaceChildren();

    if (!citas.length) {
      mostrarWidgetVacio(lista, "No hay citas para hoy");
      return;
    }

    [...citas]
      .sort((a, b) => (a.appointment_time || "").localeCompare(b.appointment_time || ""))
      .forEach(cita => {
        const fila = crearFilaWidget(
          `${cita.appointment_time || "--:--"} · ${cita.customer_name || "Sin cliente"}`,
          `${cita.service_name || "Sin servicio"} · ${cita.status || "Sin estado"}`
        );
        lista.appendChild(fila);
      });
  }

  function renderizarAnticipos(citas) {
    const contador = document.getElementById("anticipos-contador");
    const lista = document.getElementById("anticipos-lista");
    contador.textContent = `${citas.length} personas con anticipo`;
    lista.replaceChildren();

    if (!citas.length) {
      mostrarWidgetVacio(lista, "No hay anticipos registrados");
      return;
    }

    [...citas]
      .sort((a, b) => {
        const fechaA = `${a.appointment_date || ""} ${a.appointment_time || ""}`;
        const fechaB = `${b.appointment_date || ""} ${b.appointment_time || ""}`;
        return fechaB.localeCompare(fechaA);
      })
      .forEach(cita => {
        const monto = new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0
        }).format(cita.anticipo_monto || 0);
        lista.appendChild(crearFilaWidget(
          cita.customer_name || "Sin cliente",
          `${monto} · ${cita.appointment_date || "Sin fecha"}`
        ));
      });
  }

  function renderizarStockBajo(bodega) {
    const contador = document.getElementById("stock-bajo-contador");
    const lista = document.getElementById("stock-bajo-lista");
    const productos = (bodega.categorias || [])
      .flatMap(categoria => categoria.productos || [])
      .filter(producto => producto.stock_bajo);
    contador.textContent = `${productos.length} productos en alerta`;
    lista.replaceChildren();

    if (!productos.length) {
      mostrarWidgetVacio(lista, "No hay productos con stock bajo");
      return;
    }

    productos.forEach(producto => {
      lista.appendChild(crearFilaWidget(
        producto.name || "Producto sin nombre",
        `Stock: ${producto.stock} · Mínimo: ${producto.min_stock}`
      ));
    });
  }

  function crearFilaWidget(titulo, detalle) {
    const fila = document.createElement("div");
    fila.className = "dashboard-widget-fila";
    const tituloEl = document.createElement("strong");
    tituloEl.textContent = titulo;
    const detalleEl = document.createElement("span");
    detalleEl.textContent = detalle;
    fila.append(tituloEl, detalleEl);
    return fila;
  }

  function mostrarWidgetVacio(lista, mensaje) {
    const vacio = document.createElement("span");
    vacio.className = "dashboard-widget-vacio";
    vacio.textContent = mensaje;
    lista.appendChild(vacio);
  }
}

// ===== Renderizar resumen =====
function renderizarResumen(dashboard) {
  // Hoy
  document.getElementById("resumen-hoy-total").textContent = `$${formatearNumero(dashboard.hoy.total)}`;
  document.getElementById("resumen-hoy-transacciones").textContent = `${dashboard.hoy.transacciones} transacciones`;
  
  // Semana
  document.getElementById("resumen-semana-total").textContent = `$${formatearNumero(dashboard.semana_actual.total)}`;
  document.getElementById("resumen-semana-transacciones").textContent = `${dashboard.semana_actual.transacciones} transacciones`;
  
  // Mes
  document.getElementById("resumen-mes-total").textContent = `$${formatearNumero(dashboard.mes_actual.total)}`;
  document.getElementById("resumen-mes-transacciones").textContent = `${dashboard.mes_actual.transacciones} transacciones`;
  document.getElementById("resumen-gastos-pendientes").textContent =
    `$${formatearNumero(dashboard.gastos_pendientes || 0)}`;
}

// ===== Renderizar gráfica =====
function renderizarGrafica(ultimos_7_dias) {
  const ctx = document.getElementById('grafica-7-dias').getContext('2d');
  
  // Obtener colores de las variables CSS
  const colorAcento = getComputedStyle(document.documentElement).getPropertyValue('--color-acento').trim();
  const colorPrimario = getComputedStyle(document.documentElement).getPropertyValue('--color-primario').trim();
  
  // Formatear fechas para el eje X (ej: "Lun 08")
  const etiquetas = ultimos_7_dias.map(dia => {
    const fecha = new Date(dia.fecha + 'T00:00:00');
    const diaSemana = fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
    return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  });
  
  const datos = ultimos_7_dias.map(dia => dia.total);
  
  // Destruir gráfica existente si hay
  if (grafica7Dias) {
    grafica7Dias.destroy();
  }
  
  grafica7Dias = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Ventas',
        data: datos,
        backgroundColor: colorAcento,
        borderColor: colorAcento,
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `$${formatearNumero(context.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: colorPrimario,
            callback: function(value) {
              return '$' + formatearNumero(value);
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          ticks: {
            color: colorPrimario
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ===== Renderizar producto más vendido =====
function renderizarProductoMasVendido(producto) {
  const nombreEl = document.getElementById("producto-mas-vendido-nombre");
  const cantidadEl = document.getElementById("producto-mas-vendido-cantidad");
  
  if (producto) {
    nombreEl.textContent = producto.nombre;
    cantidadEl.textContent = `${producto.cantidad_vendida} unidades vendidas`;
  } else {
    nombreEl.textContent = "Aún no hay suficientes ventas para este dato";
    cantidadEl.textContent = "-";
  }
}

// ===== Utilidades =====
function formatearNumero(valor) {
  return Number(valor).toLocaleString("es-CO");
}

// ===== Configurar botón de actualizaciones =====
function configurarBotonActualizaciones(sesion) {
  const btnActualizaciones = document.getElementById('btn-buscar-actualizaciones');
  
  // Solo mostrar el botón para usuarios ADMIN
  if (sesion.role === 'ADMIN' && btnActualizaciones) {
    btnActualizaciones.style.display = 'flex';
    
    btnActualizaciones.addEventListener('click', async () => {
      try {
        // Mostrar loading
        btnActualizaciones.disabled = true;
        btnActualizaciones.innerHTML = '<i class="bi bi-hourglass-split"></i> Verificando...';
        
        const resultado = await verificarActualizacion();
        
        if (resultado.hay_actualizacion) {
          // Hay actualización disponible
          Swal.fire({
            icon: 'info',
            title: '¡Actualización disponible!',
            html: `
              <p>Hay una nueva versión disponible: <strong>${resultado.version_remota}</strong></p>
              <p>Versión actual: ${resultado.version_local}</p>
              <p style="font-size: 13px; color: #666; margin-top: 10px;">${resultado.notas || ''}</p>
              <p style="margin-top: 15px; font-size: 14px;">Contáctate con Mundo Tech para obtener la actualización.</p>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#1e3a5f'
          });
        } else {
          // No hay actualización
          Swal.fire({
            icon: 'success',
            title: 'Sistema actualizado',
            text: resultado.mensaje || 'Estás usando la versión más reciente del sistema.',
            confirmButtonColor: '#1e3a5f'
          });
        }
      } catch (error) {
        console.error('Error al verificar actualizaciones:', error);
        Swal.fire({
          icon: 'warning',
          title: 'Error de conexión',
          text: 'No se pudo verificar actualizaciones. Verifica tu conexión a internet.',
          confirmButtonColor: '#1e3a5f'
        });
      } finally {
        // Restaurar botón
        btnActualizaciones.disabled = false;
        btnActualizaciones.innerHTML = '<i class="bi bi-cloud-download"></i> Buscar actualizaciones';
      }
    });
  }
}

iniciar();
