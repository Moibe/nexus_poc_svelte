/**
 * Los orígenes desde los que se puede entrar a la app además del propio (`ORIGIN` del proceso). Los comparte `vite.config.ts`
 * (`csrf.trustedOrigins`, la comprobación de formularios de SvelteKit) y `hooks.server.ts` (la comprobación de peticiones JSON, NEX-562), para
 * que una sola lista decida las dos. Se hornea en el BUILD: agregar uno exige reconstruir, no basta reiniciar.
 *
 * Los nombres concretos de los ambientes están en la documentación operativa interna (NEX-565), no en comentarios del repositorio. Cada
 * dominio va con sus dos esquemas porque la comparación es por cadena exacta. Los `http://` existen porque la gente entra por HTTP en la red
 * interna mientras no haya HTTPS en todas las entradas (NEX-547); cuando eso pase, se quitan de aquí y de ningún otro lado.
 */

const DOMINIOS = [
	'biblioratum.buzzword.com.mx',
	'dev-biblioratum.buzzword.com.mx',
	'staging-biblioratum.buzzword.com.mx',
	// Alias anteriores que siguen atendiendo mientras el DNS de los nuevos no esté completo.
	'nexus-doc.buzzword.com.mx',
	'dev-nexus-doc.buzzword.com.mx'
];

export const ORIGENES_DE_CONFIANZA: readonly string[] = DOMINIOS.flatMap((d) => [`https://${d}`, `http://${d}`]);
