/**
 * ¿Esto tiene forma de correo electrónico?
 *
 * Hasta el 2026-10-09 esta regla estaba copiada en tres pantallas (login, alta
 * de organización y alta de usuario) y FALTABA en las dos de recuperación, que
 * son justo las que importan cuando alguien pierde el acceso. Peor: donde
 * existía solo servía para apagar el botón de guardar, así que quien escribía
 * "pepito" se quedaba viendo un botón gris sin ninguna explicación. Vive aquí
 * para que lo normal sea que un campo de correo nazca validado y avisando.
 *
 * Es la MISMA regla que aplica el servidor (`servicios/usuarios.py`:
 * `_RE_CORREO` y `correo_valido`, con el mismo tope de 254). Si una cambia,
 * la otra también: si el front deja pasar algo que el servidor rechaza, la
 * persona se entera hasta el final y con un mensaje genérico.
 *
 * Solo mira la FORMA. No comprueba que el buzón exista ni que alguien lo lea;
 * eso solo lo diría mandar un correo, y en este sprint no hay correo.
 *
 * Deliberadamente laxa, como la del servidor: acepta `+`, guiones, subdominios
 * y dominios largos, porque rechazar un correo legítimo es peor que aceptar
 * uno raro —al final lo que manda es si la persona recibe o no—. Lo que sí
 * descarta es lo que claramente no es un correo: sin arroba, sin punto en el
 * dominio, con espacios o con más de una arroba.
 */

export const LARGO_MAXIMO_CORREO = 254;

/** El texto del diseño para un correo mal escrito (pantalla de login, Figma
 *  `184:7335`). Se reusa en todos lados para no tener dos maneras de decir lo
 *  mismo. */
export const MENSAJE_CORREO_INVALIDO = 'Formato incorrecto; por favor ingresa un correo electrónico válido.';

const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ResultadoCorreo = { ok: true; correo: string } | { ok: false; motivo: string };

/**
 * @param texto lo que la persona escribió, tal cual.
 * @param obligatorio `false` para los campos opcionales (los de recuperación):
 *        entonces vacío es válido. Con `true`, vacío es un error con su propio
 *        mensaje, porque "formato incorrecto" no describe un campo en blanco.
 */
export function validarCorreo(texto: string, obligatorio = true): ResultadoCorreo {
	const limpio = texto.trim();
	if (limpio === '') {
		return obligatorio
			? { ok: false, motivo: 'Por favor, ingresa un correo electrónico válido.' }
			: { ok: true, correo: '' };
	}
	// El tope va ANTES de la regex: uno de 300 caracteres tampoco es válido, y
	// este mensaje dice qué pasó en vez de dejarlo en "formato incorrecto".
	if (limpio.length > LARGO_MAXIMO_CORREO) {
		return { ok: false, motivo: `El correo no puede pasar de ${LARGO_MAXIMO_CORREO} caracteres.` };
	}
	if (!RE_CORREO.test(limpio)) return { ok: false, motivo: MENSAJE_CORREO_INVALIDO };
	// En minúsculas porque el servidor normaliza así: que lo que se ve aquí sea
	// lo que va a quedar guardado.
	return { ok: true, correo: limpio.toLowerCase() };
}

/** Atajo para los `$derived` que solo quieren el sí o el no. */
export function correoValido(texto: string, obligatorio = true): boolean {
	return validarCorreo(texto, obligatorio).ok;
}
