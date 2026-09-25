import bcrypt

password = "monitoreo12345"  # la contraseña real que va a usar el barbero, cámbiala
hash_generado = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
print(hash_generado.decode("utf-8"))