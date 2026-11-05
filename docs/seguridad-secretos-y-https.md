# Seguridad: secretos compartidos y entrada por HTTPS

Nace de la auditoría de seguridad de código del 2026-10-30 (historia NEX-546). Cubre lo que **no se puede arreglar solo con código**:
el procedimiento para rotar los secretos que comparten el front y nexus_back (hallazgo NX-06, NEX-555) y lo que falta de infraestructura
para que las cookies de sesión nunca viajen sin cifrar (hallazgo NX-01, NEX-547). Los valores concretos de cada ambiente (direcciones,
dominios, rutas del servidor) viven en la documentación operativa interna, **no** aquí (NEX-565).

## 1. Los dos secretos que comparten el front y el back

| Secreto | Dónde vive | Para qué sirve |
| --- | --- | --- |
| `AUTH_JWT_SECRET` | `.env` de nexus_back **y** `.env` del front | El back firma con él los JWT de acceso (HS256, 15 minutos); el front los verifica con el mismo. |
| `NEXUS_API_KEY` | `.env` de nexus_back **y** `.env` del front | El front la manda en `X-API-Key` en cada llamada al back; sin ella el back responde 401. |

Quien comprometa el `.env` del servidor del front puede **forjar JWT** (rol, administrador de plataforma y organización arbitrarios): por eso el
acceso a esos archivos debe estar restringido (propietario único, permisos `600`, sin copias ni respaldos legibles por otros) y por eso existe esta
rotación. nexus_back sigue comprobando la sesión y el rol por su cuenta (`servicios/aislamiento.py`), de modo que un JWT forjado no abre lo que el
back no abriría con una sesión real; aun así, la rotación debe poder hacerse en minutos.

### Rotar `AUTH_JWT_SECRET`

1. Generar uno nuevo (mínimo 32 caracteres): `python -c "import secrets; print(secrets.token_urlsafe(48))"`. No se imprime en tickets, chats ni logs.
2. Ponerlo en el `.env` de **nexus_back** y en el `.env` del **front** del mismo ambiente. No hace falta que sea simultáneo al segundo.
3. Reiniciar primero nexus_back y después el front (`pm2 restart`, que además relee el `.env` con `--env-file`).
4. Comprobar `/health`, iniciar sesión y abrir una pantalla.

Qué pasa con las sesiones abiertas: los JWT de acceso emitidos con el secreto viejo dejan de valer. El navegador de cada persona tiene además su
*refresh token* (opaco, guardado en el back, 7 días), así que el front renueva solo la sesión con el secreto nuevo en la siguiente petición: **nadie
tiene que volver a entrar**. Entre el reinicio del back y el del front puede haber unos segundos de 401 que se curan solos. Si se sospecha que el
secreto viejo se filtró, además hay que cerrar las sesiones (el refresh token no cambia con el secreto): `POST /usuarios/{guid}/cerrar-sesion` por
persona, o rotar la contraseña de las cuentas afectadas.

### Rotar `NEXUS_API_KEY`

1. Generar una nueva (`secrets.token_urlsafe(48)`).
2. Ponerla en los dos `.env` y reiniciar **los dos procesos a la vez**: entre un reinicio y el otro, las llamadas del front reciben 401 del back.
3. Comprobar que el front lista algo (por ejemplo la bandeja) y que `/health` del back responde.

Las llaves que emite el módulo «API Key» para clientes y los `secret` de los webhooks son **otra cosa**: se rotan desde la propia aplicación.

### Firma asimétrica: decisión pendiente

Con HS256 el front guarda el mismo secreto con que se firma, así que comprometerlo equivale a poder emitir tokens. Pasar a una firma asimétrica
(EdDSA o RS256: el back firma con la llave privada, el front verifica solo con la pública) cierra esa puerta: robar el `.env` del front ya no permite
forjar nada. Costo: cambiar `servicios/auth.py` del back (firma y verificación) y `verificarToken` del front, publicar la llave pública, y un
periodo de transición con los dos algoritmos aceptados. **No se hace en esta entrega**: es una decisión de arquitectura de Tech Lead y PM.
La llave de servicio (`NEXUS_API_KEY`) seguiría siendo simétrica y estática; las alternativas son mTLS entre los dos procesos o un token de servicio
con vida corta.

## 2. Que las cookies de sesión nunca viajen sin cifrar (NEX-547)

Lo que ya hace el código: las cookies `nx_acceso`, `nx_refresh` y `nx_navegador` se emiten con `Secure` cuando la conexión de la persona es HTTPS,
y la app lo decide mirando también `X-Forwarded-Proto` (detrás del proxy que termina el TLS el proceso solo ve HTTP). Borrar la sesión usa el mismo
atributo con que se creó (hubo un fallo de cierre de sesión por eso el 2026-10-12: no romperlo).

Lo que **falta y es de infraestructura** (no se arregla en el repositorio):

- Servir **todas** las entradas por HTTPS, incluida la que hoy es por IP en la red interna, o cerrarla. Mientras exista una entrada por HTTP plano,
  quien entre por ella manda su sesión de 7 días sin cifrar. Quitar esa entrada también permite sacar los orígenes `http://` de
  `src/lib/seguridad/origenes.ts`.
- En el proxy: redirigir HTTP a HTTPS, `Strict-Transport-Security` (la app **no** la pone a propósito: también se sirve por HTTP plano en la red
  interna, donde esa cabecera no tiene sentido) y reenviar `X-Forwarded-Proto` / `X-Forwarded-For`.
- En el `.env` del front: `ADDRESS_HEADER`, `XFF_DEPTH` y `PROTOCOL_HEADER` (ver `.env.example`), para que la IP que ven el tope de frecuencia y las
  bitácoras sea la de la persona y no la del proxy.
- Confirmar si el mismo comportamiento existe en dev, staging y producción (CA-04 de NEX-547) y, si hubo exposición, cerrar las sesiones activas
  después del cambio (CA-05): con el procedimiento de arriba.
