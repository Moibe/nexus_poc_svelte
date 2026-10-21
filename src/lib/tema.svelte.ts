/**
 * El tema claro / oscuro (2026-10-09, a pedido: el menú de la cuenta lo pide
 * con un interruptor).
 *
 * El tema oscuro ya estaba definido en `app.css` —un bloque `.dark` con todos
 * los tokens— desde la plantilla; lo único que faltaba era poner esa clase en
 * el `<html>` y recordar la preferencia. Eso es lo que hace este módulo.
 *
 * Tres estados, no dos: **sistema** (lo que diga el equipo), **claro** y
 * **oscuro**. El interruptor del menú solo distingue encendido/apagado, pero
 * guardar "sistema" como estado propio evita quedarse clavado en claro cuando
 * alguien nunca lo ha tocado y su equipo cambia a oscuro por la tarde.
 *
 * Se guarda en `localStorage` porque es una preferencia de ESTE navegador, no
 * del usuario en el servidor: la misma persona puede querer oscuro en su
 * laptop y claro en la pantalla grande de la oficina.
 */

export type Tema = 'sistema' | 'claro' | 'oscuro';

const CLAVE = 'nexusdoc:tema';

/** La preferencia guardada; `sistema` si no hay ninguna o si no se puede leer
 *  (modo privado, almacenamiento bloqueado). */
function guardado(): Tema {
	try {
		const valor = localStorage.getItem(CLAVE);
		return valor === 'claro' || valor === 'oscuro' ? valor : 'sistema';
	} catch {
		return 'sistema';
	}
}

function elEquipoPrefiereOscuro(): boolean {
	return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

class EstadoTema {
	preferencia = $state<Tema>('sistema');
	/** Lo que de verdad se está viendo, ya resuelto. */
	oscuro = $state(false);

	/** Lee la preferencia y la aplica. Se llama una vez, al montar el layout. */
	iniciar() {
		this.preferencia = guardado();
		this.aplicar();
		// Si está en "sistema", seguir al equipo cuando cambie (de día a noche).
		window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
			if (this.preferencia === 'sistema') this.aplicar();
		});
	}

	aplicar() {
		this.oscuro = this.preferencia === 'oscuro' || (this.preferencia === 'sistema' && elEquipoPrefiereOscuro());
		document.documentElement.classList.toggle('dark', this.oscuro);
		// Para que los controles del navegador (barras de scroll, campos) vayan
		// a juego; si no, en oscuro aparecen blancos.
		document.documentElement.style.colorScheme = this.oscuro ? 'dark' : 'light';
	}

	fijar(preferencia: Tema) {
		this.preferencia = preferencia;
		try {
			if (preferencia === 'sistema') localStorage.removeItem(CLAVE);
			else localStorage.setItem(CLAVE, preferencia);
		} catch {
			/* sin almacenamiento, el tema dura lo que la pestaña */
		}
		this.aplicar();
	}

	/** Lo que usa el interruptor del menú. */
	alternar() {
		this.fijar(this.oscuro ? 'claro' : 'oscuro');
	}
}

export const tema = new EstadoTema();
