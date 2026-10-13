// Copies the published pieces of the channel into this site: one Markdown
// entry per piece in src/content/piezas and its cover in src/assets/piezas.
// The channel repo is the source of truth; run this after uploading a piece.
//
//   npm run sincronizar            (channel at ../../activos/piezas-menores)
//   PIEZAS_CANAL=/ruta npm run sincronizar
//
// Per piece it reads, from the channel:
//   publicar/subidos/NN-slug/publicacion.md   title, series, description
//   publicar/subidos/NN-slug/portada.jpg      cover
//   pilotos/NN-slug/short-01/narracion*.txt   narration (latest version)
//   pilotos/NN-slug/short-01/guion-short.md   "La jugada" and the verification table
// and the YouTube id from src/data/youtube.json (filled by hand after uploading).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canal = path.resolve(raiz, process.env.PIEZAS_CANAL ?? '../../activos/piezas-menores');
const subidos = path.join(canal, 'publicar', 'subidos');
const destinoContenido = path.join(raiz, 'src', 'content', 'piezas');
const destinoPortadas = path.join(raiz, 'src', 'assets', 'piezas');
const ANCHO_PORTADA = 720;

if (!existsSync(subidos)) {
	console.error(`No encuentro ${subidos}. Indicá la carpeta del canal con PIEZAS_CANAL.`);
	process.exit(1);
}

const youtube = JSON.parse(await readFile(path.join(raiz, 'src', 'data', 'youtube.json'), 'utf8'));

const sinEmojis = (texto) => texto.replace(/\p{Extended_Pictographic}|️/gu, '').replace(/\s+/g, ' ').trim();
const leerSiExiste = async (archivo) => (existsSync(archivo) ? readFile(archivo, 'utf8') : '');

/** First paragraph of the YouTube description: the public summary of the piece. */
function leerBajada(publicacion) {
	const descripcion = publicacion.split('**Descripción:**')[1] ?? '';
	return sinEmojis(descripcion.trim().split(/\n\s*\n/)[0] ?? '');
}

/** Narration lines; when there are several versions the last one is what was recorded. */
async function leerNarracion(carpetaShort) {
	if (!existsSync(carpetaShort)) return [];
	const versiones = (await readdir(carpetaShort)).filter((nombre) => /^narracion.*\.txt$/.test(nombre)).sort();
	if (versiones.length === 0) return [];
	const texto = await readFile(path.join(carpetaShort, versiones.at(-1)), 'utf8');
	return texto.split('\n').map((linea) => linea.trim()).filter(Boolean);
}

function leerJugada(guion) {
	const linea = guion.match(/^- \*\*La jugada:\*\*\s*(.+)$/m)?.[1];
	if (!linea) return null;
	const [concepto, ...resto] = linea.split(' — ');
	return { concepto: concepto.trim(), definicion: resto.join(' — ').trim() };
}

/**
 * The verification table is a working document: it also lists what was left
 * out and what is only medium confidence. Only rows confirmed with a public
 * source (or our own arithmetic) go to the site.
 */
function leerDatosVerificados(guion) {
	const datos = [];
	let fuenteAnterior = '';
	for (const fila of guion.split('\n').filter((linea) => linea.startsWith('|'))) {
		const [dato, estado, fuente] = fila.split('|').slice(1, 4).map((celda) => celda.trim());
		if (!estado?.startsWith('✅')) continue;
		const fuenteReal = /^ídem$/i.test(fuente) ? fuenteAnterior : fuente;
		fuenteAnterior = fuenteReal;
		if (/media/.test(estado)) continue;
		const esCalculo = /cálculo/.test(estado);
		if (!esCalculo && (!fuenteReal || fuenteReal === '—' || fuenteReal === 'agente')) continue;
		datos.push({
			// " → " introduces a note on how the fact was phrased in the narration
			dato: dato.split(' → ')[0].trim(),
			fuente: esCalculo ? 'Cálculo propio' : fuenteReal,
		});
	}
	return datos;
}

await mkdir(destinoContenido, { recursive: true });
await mkdir(destinoPortadas, { recursive: true });

const carpetas = (await readdir(subidos, { withFileTypes: true }))
	.filter((entrada) => entrada.isDirectory() && /^\d+-/.test(entrada.name))
	.map((entrada) => entrada.name)
	.sort();

let escritas = 0;
const sinVideo = [];
for (const carpeta of carpetas) {
	const archivoPublicacion = path.join(subidos, carpeta, 'publicacion.md');
	const archivoPortada = path.join(subidos, carpeta, 'portada.jpg');
	if (!existsSync(archivoPublicacion) || !existsSync(archivoPortada)) {
		console.warn(`  salteo ${carpeta}: falta publicacion.md o portada.jpg`);
		continue;
	}

	const publicacion = await readFile(archivoPublicacion, 'utf8');
	const titulo = publicacion.match(/^\*\*Título:\*\*\s*(.+)$/m)?.[1];
	const serie = publicacion.match(/Serie:\s*(.+)$/m)?.[1];
	if (!titulo || !serie) {
		console.warn(`  salteo ${carpeta}: no pude leer título o serie`);
		continue;
	}

	const carpetaShort = path.join(canal, 'pilotos', carpeta, 'short-01');
	const guion = await leerSiExiste(path.join(carpetaShort, 'guion-short.md'));
	const narracion = await leerNarracion(carpetaShort);
	const jugada = leerJugada(guion);
	const datos = leerDatosVerificados(guion);
	if (!youtube[carpeta]) sinVideo.push(carpeta);

	await sharp(archivoPortada)
		.resize({ width: ANCHO_PORTADA })
		.jpeg({ quality: 82, mozjpeg: true })
		.toFile(path.join(destinoPortadas, `${carpeta}.jpg`));

	const frontmatter = [
		'---',
		`numero: ${Number(carpeta.split('-')[0])}`,
		`titulo: ${JSON.stringify(sinEmojis(titulo))}`,
		`serie: ${JSON.stringify(serie.trim())}`,
		`portada: ../../assets/piezas/${carpeta}.jpg`,
		`bajada: ${JSON.stringify(leerBajada(publicacion))}`,
		...(youtube[carpeta] ? [`youtube: ${JSON.stringify(youtube[carpeta])}`] : []),
		...(jugada ? ['jugada:', `  concepto: ${JSON.stringify(jugada.concepto)}`, `  definicion: ${JSON.stringify(jugada.definicion)}`] : []),
		'narracion:',
		...narracion.map((linea) => `  - ${JSON.stringify(linea)}`),
		'---',
		'',
	];
	// The body is the list of verified facts; Markdown keeps the source links.
	const cuerpo = datos.map(({ dato, fuente }) => `- ${dato} — *${fuente}*`);
	await writeFile(path.join(destinoContenido, `${carpeta}.md`), [...frontmatter, ...cuerpo, ''].join('\n'));
	escritas++;
}

console.log(`${escritas} piezas sincronizadas desde ${subidos}`);
if (sinVideo.length > 0) {
	console.log(`Sin video en src/data/youtube.json: ${sinVideo.join(', ')}`);
}
