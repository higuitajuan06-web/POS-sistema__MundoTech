// Login del sistema POS
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const usuario = await iniciarSesion(username, password);
    // Si llegamos aquí, el login fue exitoso

    // Mostrar aviso de licencia si existe
    if (usuario.aviso_licencia) {
      Swal.fire({
        icon: 'warning',
        title: 'Aviso de Licencia',
        text: usuario.aviso_licencia,
        confirmButtonColor: '#16a34a'
      }).then(() => {
        window.location.href = "index.html";
      });
    } else {
      Swal.fire({
        icon: 'success',
        title: '¡Bienvenido!',
        text: `Hola, ${usuario.username || usuario.name || 'Usuario'}. Has iniciado sesión correctamente.`,
        timer: 2000,
        showConfirmButton: false,
        confirmButtonColor: '#16a34a'
      }).then(() => {
        window.location.href = "index.html";
      });
    }
  } catch (error) {
    loginError.textContent = error.message;
  }
});
