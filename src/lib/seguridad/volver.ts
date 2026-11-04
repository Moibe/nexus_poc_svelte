/**
 * A dónde mandar a la persona después de iniciar sesión según el parámetro `volver` de la dirección (NEX-553, auditoría de seguridad
 * 2026-10-30, hallazgo NX-04).
 *
 * El parámetro lo escribe quien arma el enlace, así que no se puede confiar en él: `/\sitio` empieza con «/» y no con «//», pero los
 * navegadores tratan la diagonal invertida como una normal y lo leen como `//sitio`, o sea otro sitio. Por eso no se valida solo el texto:
 * se resuelve contra el origen de la app y se comprueba que el resultado siga siendo de la app. Todo lo que no es una ruta de la propia
 * app cae en «/».
 *
 * Es puro (sin `$app` ni nada del navegador) para poder probarlo con casos sueltos.
 */

/** La ruta interna a la que se puede volver, o «/» si `volver` no es una ruta de este mismo origen. */
export function destinoDeVolver(volver: string | null | undefined, origen: string): string {
	if (typeof volver !== 'string' || volver === '') return '/';
	// Una ruta de la app empieza con UNA diagonal. Ni «//» ni «/\» (que el navegador lee como «//»), ni caracteres de control, ni
	// diagonales invertidas en ningún lado (no tienen sentido en una ruta de la app y es lo que usan los trucos de redirección).
	if (!volver.startsWith('/') || volver.startsWith('//')) return '/';
	if (/[\u0000-\u001f\u007f\\]/.test(volver)) return '/';
	let url: URL;
	try {
		url = new URL(volver, origen);
	} catch {
		return '/';
	}
	if (url.origin !== origen) return '/';
	// Lo codificado también: «/%5Csitio» o «/%2F%2Fsitio» no deben volverse «//sitio» en ningún paso posterior que decodifique.
	try {
		const decodificada = decodeURIComponent(url.pathname);
		if (decodificada.startsWith('//') || decodificada.startsWith('/\\') || /[\u0000-\u001f\u007f\\]/.test(decodificada)) return '/';
	} catch {
		return '/';
	}
	return url.pathname + url.search + url.hash;
}
