// Función para manejar el cierre de caja
async function manejarCierreCaja() {
  try {
    const sesion = await obtenerSesionActual();
    
    // Si es ADMIN, solo cerrar sesión sin proceso de cierre de caja
    if (sesion && sesion.role === "ADMIN") {
      const result = await Swal.fire({
        title: '¿Cerrar sesión?',
        text: '¿Estás seguro de que deseas cerrar tu sesión de administrador?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#E8792F',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Cerrar sesión',
        cancelButtonText: 'Cancelar'
      });
      
      if (result.isConfirmed) {
        try {
          await cerrarSesion();
          Swal.fire({
            icon: 'success',
            title: 'Sesión cerrada',
            text: 'Has cerrado tu sesión correctamente.',
            timer: 1500,
            showConfirmButton: false,
            confirmButtonColor: '#16a34a'
          }).then(() => {
            window.location.href = 'login.html';
          });
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo cerrar la sesión: ${error.message}`,
            confirmButtonColor: '#E8792F'
          });
        }
      }
      return;
    }
    
    // Para usuarios normales, proceso completo de cierre de caja
    const cierre = await obtenerCierreCaja();
    
    // Formatear el total en moneda
    const formatoMoneda = (amount) => {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };
    
    // Crear el HTML del resumen
    const resumenHTML = `
      <div class="cierre-caja-resumen" id="cierre-caja-print">
        <div class="cierre-header">
          <h3>Mundo Tech - Cierre de Caja</h3>
          <p><strong>Fecha:</strong> ${cierre.fecha}</p>
          <p><strong>Vendedor:</strong> ${cierre.vendedor}</p>
        </div>
        
        <div class="cierre-total">
          <p>Total del día</p>
          <p class="monto-grande">${formatoMoneda(cierre.total_ventas)}</p>
        </div>
        
        <div class="cierre-desglose">
          <h4>Desglose por método de pago</h4>
          <div class="desglose-item">
            <i class="bi bi-cash-stack"></i>
            <span>Efectivo:</span>
            <span>${formatoMoneda(cierre.desglose_pagos.CASH)}</span>
          </div>
          <div class="desglose-item">
            <i class="bi bi-credit-card"></i>
            <span>Tarjeta:</span>
            <span>${formatoMoneda(cierre.desglose_pagos.CARD)}</span>
          </div>
          <div class="desglose-item">
            <i class="bi bi-bank"></i>
            <span>Transferencia:</span>
            <span>${formatoMoneda(cierre.desglose_pagos.TRANSFER)}</span>
          </div>
        </div>
        
        <div class="cierre-transacciones">
          <p><strong>Transacciones:</strong> ${cierre.cantidad_transacciones}</p>
        </div>
      </div>
    `;
    
    const result = await Swal.fire({
      title: 'Cierre de Caja',
      html: resumenHTML,
      width: '600px',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Confirmar Cierre',
      denyButtonText: 'Imprimir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#E8792F',
      denyButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      customClass: {
        popup: 'cierre-caja-modal'
      }
    });
    
    if (result.isDenied) {
      // Botón Imprimir
      const contenidoImprimir = document.getElementById('cierre-caja-print');
      if (contenidoImprimir) {
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = contenidoImprimir.outerHTML;
        window.print();
        document.body.innerHTML = originalContents;
        location.reload(); // Recargar para restaurar el estado original
      }
    } else if (result.isConfirmed) {
      // Botón Confirmar Cierre
      try {
        // Primero confirmar el cierre de caja en el backend
        await confirmarCierreCaja();
        
        // Solo si el cierre fue exitoso, cerrar sesión
        await cerrarSesion();
        
        Swal.fire({
          icon: 'success',
          title: '¡Cierre de caja exitoso!',
          text: 'Has cerrado tu sesión correctamente. ¡Buen descanso!',
          timer: 2000,
          showConfirmButton: false,
          confirmButtonColor: '#16a34a'
        }).then(() => {
          window.location.href = 'login.html';
        });
      } catch (error) {
        // Si falla el cierre de caja, mostrar error y NO cerrar sesión
        Swal.fire({
          icon: 'error',
          title: 'Error al cerrar caja',
          text: `No se pudo guardar el cierre de caja: ${error.message}. Tu sesión sigue activa.`,
          confirmButtonColor: '#E8792F'
        });
      }
    }
    // Si es cancelado, no hacemos nada
    
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo obtener el cierre de caja: ${error.message}`,
      confirmButtonColor: '#E8792F'
    });
  }
}

// NOTA: El event listener para el botón de cerrar caja ahora se maneja en sidebar.js
// para mantener la consistencia del menú según el rol del usuario