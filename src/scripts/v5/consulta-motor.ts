// El cableado entre la presentación (consulta.ts) y la lógica del asistente (src/lib/asistente): arma la configuración desde
// el marcador que dejó Consulta.astro y crea el controlador. No hay lógica de red acá: la hace el controlador.
//
// Modo `simulado` (solo `npm run dev`, sin Worker ni clave): el MISMO controlador, pero con un `fetch` falso que responde como
// el Worker (consulta-simulado.ts). Se carga con un `import()` dentro de `import.meta.env.DEV`: Vite lo saca del build de
// producción, así que ahí no existe ni se puede activar.
import { crearAsistente } from '../../lib/asistente/controlador.ts';
import { turnstileDePrueba, turnstileNavegador } from '../../lib/asistente/turnstile-navegador.ts';
import type { Asistente, ConfigAsistente, Idioma, ProveedorTurnstile } from '../../lib/asistente/tipos.ts';
import { esModoPrueba } from '../../v5/consulta/config.ts';

export interface DondeVerificar {
	/** El elemento de la hoja donde Turnstile dibuja su recuadro, si Cloudflare pide una interacción. */
	montaje: HTMLElement;
}

export async function crearMotor(marca: HTMLElement, idioma: Idioma, donde: DondeVerificar): Promise<{ asistente: Asistente; prueba: boolean }> {
	const modo = marca.dataset.modo ?? '';
	const sitekey = marca.dataset.sitekey ?? '';
	const base: Omit<ConfigAsistente, 'urlApi' | 'turnstile'> = {
		idioma,
		contacto: {
			correo: marca.dataset.correo ?? '',
			linkedin: marca.dataset.linkedin ?? '',
			cvs: (marca.dataset.cvs ?? '').split(' ').filter((c) => c !== ''),
			casos: (marca.dataset.casos ?? '').split(' ').filter((c) => c !== ''),
		},
		pagina: () => location.pathname,
		enLinea: () => navigator.onLine,
	};

	if (modo === 'simulado') {
		if (!import.meta.env.DEV) throw new Error('el modo simulado solo existe en desarrollo');
		const { escenarioDeLaDireccion, crearFetchSimulado, URL_SIMULADA } = await import('./consulta-simulado.ts');
		const escenario = escenarioDeLaDireccion(location.search);
		const asistente = crearAsistente({
			...base,
			urlApi: URL_SIMULADA,
			turnstile: turnstileDePrueba(),
			fetch: crearFetchSimulado(escenario, idioma),
			tiempoMaxMs: escenario === 'tiempo' ? 2000 : undefined,
		});
		// «sin-red»: el navegador se comporta como si no hubiera conexión, aunque la haya
		if (escenario === 'sin-red') {
			const fijar = asistente.fijarConexion.bind(asistente);
			asistente.fijarConexion = () => fijar(false);
		}
		return { asistente, prueba: true };
	}

	const turnstile: ProveedorTurnstile =
		sitekey === '' ? turnstileDePrueba() : turnstileNavegador({ sitekey, contenedor: () => donde.montaje, idioma, tema: 'light' });
	return { asistente: crearAsistente({ ...base, urlApi: marca.dataset.api ?? '', turnstile }), prueba: esModoPrueba(modo) };
}
