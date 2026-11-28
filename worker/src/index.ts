// Punto de entrada del Worker (matiasormeno-asistente). Solo conecta las piezas: la lógica está en handler.ts.
// `contexto.generado.ts` no se versiona: lo escribe `npm run asistente:indice` antes de cada despliegue.
import { CONTEXTO, INDICE } from './contexto.generado.ts';
import { dependenciasBase, manejar } from './handler.ts';
import type { Entorno } from './handler.ts';
import { clienteDeNamespace, Limitador } from './limitador.ts';

export { Limitador };

interface EntornoWorker extends Entorno {
	LIMITADOR: NamespaceDO;
}

export default {
	fetch(req: Request, env: EntornoWorker): Promise<Response> {
		return manejar(req, env, {
			...dependenciasBase,
			fetch: (url, init) => fetch(url, init),
			limitador: clienteDeNamespace(env.LIMITADOR),
			contexto: { texto: CONTEXTO, indice: INDICE },
		});
	},
};
