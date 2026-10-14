/**
 * Las reglas de la contraseña, con el texto EXACTO de los chips del diseño
 * ("Configura tu nueva contraseña", Sprint 1). El back las vuelve a comprobar
 * (`servicios/auth.py`); aquí sirven para pintar los chips y apagar el botón.
 */

export const REGLAS = [
	{ clave: 'largo', texto: '12 caracteres', cumple: (c: string) => c.length >= 12 },
	{ clave: 'mayuscula', texto: 'Mayúscula', cumple: (c: string) => /[A-ZÁÉÍÓÚÑÜ]/.test(c) },
	{ clave: 'minuscula', texto: 'Minúscula', cumple: (c: string) => /[a-záéíóúñü]/.test(c) },
	{ clave: 'numero', texto: 'Número', cumple: (c: string) => /\d/.test(c) },
	// Los signos de puntuación ASCII, que es EXACTAMENTE lo que acepta el
	// servidor (`string.punctuation`). Hasta el 2026-10-12 esta regla era "todo
	// lo que no sea letra ASCII, número ni espacio", y dejaba pasar una `ñ`, una
	// `á` o un `€`: el medidor pintaba los cinco chips en verde y "Muy segura",
	// el botón se encendía y el servidor la rechazaba al final. Los rangos son
	// los de la tabla ASCII: ! a /, : a @, [ a `, y { a ~.
	{ clave: 'especial', texto: 'Carácter especial', cumple: (c: string) => /[!-\/:-@\[-`{-~]/.test(c) }
] as const;

export type Nivel = { texto: string; valor: number; tono: 'debil' | 'basica' | 'media' | 'segura' | 'muy_segura' };

/** El aviso de QA (HU04 caso 5): una contraseña que no cumple las reglas pinta de rojo su campo y dice esto. Es el mismo
 *  texto que el servidor responde al rechazarla (`reglas`). */
export const MENSAJE_FORMATO = 'La contraseña no cumple con el formato requerido; por favor intenta de nuevo.';

/** Cuántas reglas cumple → el nivel que muestra la tarjeta "Seguridad de la
 *  contraseña": una regla (o ninguna) es Débil, dos Básica, tres Media, cuatro
 *  Segura y las cinco "Muy segura". Hasta el 2026-10-14 el 2 se mezclaba con el
 *  Débil y "Básica" no existía: QA (NEX-334) esperaba ver "Básica". */
export function nivelDe(contrasena: string): Nivel {
	const cumplidas = REGLAS.filter((r) => r.cumple(contrasena)).length;
	if (!contrasena) return { texto: 'Débil', valor: 0, tono: 'debil' };
	if (cumplidas <= 1) return { texto: 'Débil', valor: 0.2, tono: 'debil' };
	if (cumplidas === 2) return { texto: 'Básica', valor: 0.4, tono: 'basica' };
	if (cumplidas === 3) return { texto: 'Media', valor: 0.6, tono: 'media' };
	if (cumplidas === 4) return { texto: 'Segura', valor: 0.8, tono: 'segura' };
	return { texto: 'Muy segura', valor: 1, tono: 'muy_segura' };
}

export function cumpleTodas(contrasena: string): boolean {
	return REGLAS.every((r) => r.cumple(contrasena));
}
