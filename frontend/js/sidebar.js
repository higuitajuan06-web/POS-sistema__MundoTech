// Sistema centralizado de manejo del sidebar según rol de usuario
// Este archivo se encarga de renderizar el menú lateral según el rol del usuario
// y mantener la consistencia en todas las páginas del sistema

// Configuración de elementos del menú según rol
const MENU_ITEMS = {
  ADMIN: [
    { id: 'nav-dashboard', icon: 'bi-graph-up', label: 'Dashboard', href: 'dashboard.html' },
    { id: 'nav-venta', icon: 'bi-cart', label: 'Venta', href: 'index.html' },
    { id: 'nav-historial', icon: 'bi-clock-history', label: 'Historial', href: 'historial-ventas.html' },
    { id: 'nav-clientes', icon: 'bi-person-vcard', label: 'Clientes', href: 'admin-clientes.html' },
    { id: 'nav-citas', icon: 'bi-calendar-check', label: 'Citas', href: 'citas.html' },
    { id: 'nav-gastos', icon: 'bi-wallet2', label: 'Gastos', href: 'admin-gastos.html' },
    { id: 'nav-productos', icon: 'bi-box-seam', label: 'Productos', href: 'admin-productos.html' },
    { id: 'nav-categorias', icon: 'bi-tags', label: 'Categorías', href: 'admin-categorias.html' },
    { id: 'nav-galeria', icon: 'bi-images', label: 'Galería', href: 'admin-galeria.html' },
    { id: 'nav-galeria-kiosco', icon: 'bi-display', label: 'Abrir galería para cliente', href: 'galeria-kiosco.html', nuevaPestana: true },
    { id: 'nav-bodega', icon: 'bi-boxes', label: 'Bodega', href: 'bodega.html' },
    { id: 'nav-reportes', icon: 'bi-person-badge', label: 'Reportes', href: 'admin-reportes-empleados.html' },
    { id: 'nav-cerrar-caja', icon: 'bi-box-arrow-right', label: 'Cerrar Caja', href: '#' }
  ],
  CASHIER: [
    { id: 'nav-venta', icon: 'bi-cart', label: 'Venta', href: 'index.html' },
    { id: 'nav-galeria-kiosco', icon: 'bi-display', label: 'Abrir galería para cliente', href: 'galeria-kiosco.html', nuevaPestana: true },
    { id: 'nav-historial', icon: 'bi-clock-history', label: 'Historial', href: 'historial-ventas.html' },
    { id: 'nav-clientes', icon: 'bi-person-vcard', label: 'Clientes', href: 'admin-clientes.html' },
    { id: 'nav-citas', icon: 'bi-calendar-check', label: 'Citas', href: 'citas.html' },
    { id: 'nav-cerrar-caja', icon: 'bi-box-arrow-right', label: 'Cerrar Caja', href: '#' }
  ]
};

// Función para obtener el rol del usuario actual
async function obtenerRolUsuario() {
  try {
    const sesion = await obtenerSesionActual();
    if (sesion && sesion.role) {
      return sesion.role.toUpperCase();
    }
    return 'CASHIER'; // Por defecto si no hay sesión
  } catch (error) {
    console.error('Error al obtener rol del usuario:', error);
    return 'CASHIER'; // Por defecto en caso de error
  }
}

// Función para renderizar el sidebar según el rol
async function renderizarSidebar(paginaActual = null) {
  const sidebar = document.querySelector('.app-sidebar');
  if (!sidebar) return;

  const rol = await obtenerRolUsuario();
  const items = MENU_ITEMS[rol] || MENU_ITEMS.CASHIER;

  // Limpiar el sidebar actual
  sidebar.innerHTML = '';

  // Renderizar items según el rol
  items.forEach(item => {
    const navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.id = item.id;
    
    // Determinar si este es el item activo
    const esActivo = paginaActual && item.href === paginaActual;
    if (esActivo) {
      navItem.classList.add('activo');
    }

    // Icono y texto
    navItem.innerHTML = `
      <i class="bi ${item.icon}"></i>
      <span>${item.label}</span>
    `;

    // Evento de clic para navegación
    if (item.href !== '#') {
      navItem.addEventListener('click', () => {
        if (item.nuevaPestana) {
          window.open(item.href, '_blank', 'noopener');
        } else {
          window.location.href = item.href;
        }
      });
    }

    sidebar.appendChild(navItem);
  });

  // Agregar footer con versión del sistema
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.id = 'sidebar-version-footer';
  footer.innerHTML = '<span class="version-text">Cargando versión...</span>';
  sidebar.appendChild(footer);

  // Cargar y mostrar la versión actual
  cargarVersionSistema();

  // Si es Cerrar Caja, agregar el evento especial
  const cerrarCajaItem = document.getElementById('nav-cerrar-caja');
  if (cerrarCajaItem) {
    cerrarCajaItem.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarModalCierreCaja();
    });
  }
}

// Función para obtener la página actual basada en la URL
function obtenerPaginaActual() {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  return filename || 'index.html';
}

// Función para mostrar el modal de cierre de caja
function mostrarModalCierreCaja() {
  // Esta función está definida en cierre-caja.js
  if (typeof manejarCierreCaja === 'function') {
    manejarCierreCaja();
  } else {
    console.warn('La función manejarCierreCaja no está disponible');
  }
}

// Función para cargar y mostrar la versión del sistema
async function cargarVersionSistema() {
  try {
    const versionInfo = await obtenerVersionSistema();
    const footer = document.getElementById('sidebar-version-footer');
    if (footer && versionInfo && versionInfo.version) {
      footer.innerHTML = `<span class="version-text">v${versionInfo.version}</span>`;
    }
  } catch (error) {
    console.error('Error al cargar versión del sistema:', error);
    const footer = document.getElementById('sidebar-version-footer');
    if (footer) {
      footer.innerHTML = '<span class="version-text">v??.??.??</span>';
    }
  }
}

// Función para verificar acceso a página según rol
async function verificarAccesoPagina() {
  const rol = await obtenerRolUsuario();
  const paginaActual = obtenerPaginaActual();

  // Definir páginas restringidas por rol
  const paginasAdmin = [
    'dashboard.html',
    'admin-productos.html',
    'admin-categorias.html',
    'admin-galeria.html',
    'bodega.html',
    'admin-reportes-empleados.html',
    'admin-gastos.html'
  ];

  // Si es CASHIER intentando acceder a página de admin, redirigir
  if (rol === 'CASHIER' && paginasAdmin.includes(paginaActual)) {
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

// Inicializar el sidebar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar acceso a la página actual
  const accesoPermitido = await verificarAccesoPagina();
  if (!accesoPermitido) return;

  // Renderizar el sidebar
  const paginaActual = obtenerPaginaActual();
  await renderizarSidebar(paginaActual);
});

// Exportar funciones para uso externo si es necesario
window.sidebarManager = {
  renderizarSidebar,
  obtenerRolUsuario,
  verificarAccesoPagina
};