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
	{ clave: 'especial', texto: 'Carácter especial', cumple: (c: string) => /[^A-Za-z0-9\s]/.test(c) }
] as const;

export type Nivel = { texto: string; valor: number; tono: 'debil' | 'media' | 'segura' | 'muy_segura' };

/** Cuántas reglas cumple → el nivel que muestra la tarjeta "Seguridad de la
 *  contraseña". Con todo cumplido es "Muy segura"; antes, por tramos. */
export function nivelDe(contrasena: string): Nivel {
	const cumplidas = REGLAS.filter((r) => r.cumple(contrasena)).length;
	if (!contrasena) return { texto: 'Débil', valor: 0, tono: 'debil' };
	if (cumplidas <= 2) return { texto: 'Débil', valor: 0.25, tono: 'debil' };
	if (cumplidas === 3) return { texto: 'Media', valor: 0.5, tono: 'media' };
	if (cumplidas === 4) return { texto: 'Segura', valor: 0.75, tono: 'segura' };
	return { texto: 'Muy segura', valor: 1, tono: 'muy_segura' };
}

export function cumpleTodas(contrasena: string): boolean {
	return REGLAS.every((r) => r.cumple(contrasena));
}
