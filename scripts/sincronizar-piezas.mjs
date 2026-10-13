// Copies the published pieces of the channel into this site: one Markdown
// entry per piece in src/content/piezas and its cover in src/assets/piezas.
// The channel repo is the source of truth; run this after uploading a piece.
//
//   npm run sincronizar            (channel at ../../activos/piezas-menores)
//   PIEZAS_CANAL=/ruta npm run sincronizar
//
// Only pieces whose stage is "publicada" in the channel's estado.json go to the
// site: uploaded, with a YouTube id, and past their scheduled date. The script
// refreshes that file first (herramientas/estado.py), so a scheduled piece
// shows up the first time this runs after its release.
//
// Per piece it reads, from the channel:
//   estado.json                               stage, title, series, YouTube id
//   publicar/subidos/NN-slug/publicacion.md   description
//   publicar/subidos/NN-slug/portada.jpg      cover
//   pilotos/NN-slug/short-01/narracion*.txt   narration (latest version)
//   pilotos/NN-slug/short-01/guion-short.md   "La jugada" and the verification table
//   pilotos/NN-slug/nota.md                   the long-form note, only once `verificada: true`
//
// `npm run sincronizar -- --borradores` also brings unverified notes, marked as
// drafts, to preview them locally. Never commit the result of that run.
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canal = path.resolve(raiz, process.env.PIEZAS_CANAL ?? '../../activos/piezas-menores');
const subidos = path.join(canal, 'publicar', 'subidos');
const destinoContenido = path.join(raiz, 'src', 'content', 'piezas');
const destinoPortadas = path.join(raiz, 'src', 'assets', 'piezas');
const destinoNotas = path.join(raiz, 'src', 'content', 'notas');
const conBorradores = process.argv.includes('--borradores');
const ANCHO_PORTADA = 720;

if (!existsSync(subidos)) {
	console.error(`No encuentro ${subidos}. Indicá la carpeta del canal con PIEZAS_CANAL.`);
	process.exit(1);
}

execFileSync('python3', [path.join(canal, 'herramientas', 'estado.py')], { stdio: 'ignore' });
const estado = JSON.parse(await readFile(path.join(canal, 'estado.json'), 'utf8'));
const publicadas = estado.piezas.filter((pieza) => pieza.etapa === 'publicada');

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

/**
 * A note is published only when Gus has verified it: `verificada: true` in its
 * frontmatter and no [VERIFICAR] mark left in the text. HTML comments are
 * working notes for the verification and never leave the channel.
 */
async function leerNota(archivo) {
	if (!existsSync(archivo)) return null;
	const texto = await readFile(archivo, 'utf8');
	const [, cabecera, cuerpoCrudo] = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
	if (!cabecera) return null;
	const titulo = cabecera.match(/^titulo:\s*"?(.*?)"?\s*$/m)?.[1];
	const verificada = /^verificada:\s*true\s*$/m.test(cabecera) && !cuerpoCrudo.includes('[VERIFICAR');
	const cuerpo = cuerpoCrudo.replace(/<!--[\s\S]*?-->/g, '').trim();
	return titulo ? { titulo, verificada, cuerpo } : null;
}

// These folders are generated. Whatever this run does not write is removed at
// the end, so a piece that stops being public disappears. Files are removed one
// by one: recreating the folders leaves the Astro dev server with stale entries.
const destinos = [destinoContenido, destinoPortadas, destinoNotas];
for (const destino of destinos) await mkdir(destino, { recursive: true });
const escritos = new Set();
const escribir = async (archivo, contenido) => {
	await writeFile(archivo, contenido);
	escritos.add(archivo);
};

let escritas = 0;
const notas = [];
const notasSinVerificar = [];
for (const { slug: carpeta, numero, titulo, serie, youtube } of publicadas) {
	const archivoPublicacion = path.join(subidos, carpeta, 'publicacion.md');
	const archivoPortada = path.join(subidos, carpeta, 'portada.jpg');
	if (!titulo || !serie || !existsSync(archivoPortada)) {
		console.warn(`  salteo ${carpeta}: falta título, serie o portada.jpg`);
		continue;
	}
	const publicacion = await readFile(archivoPublicacion, 'utf8');

	const carpetaShort = path.join(canal, 'pilotos', carpeta, 'short-01');
	const guion = await leerSiExiste(path.join(carpetaShort, 'guion-short.md'));
	const narracion = await leerNarracion(carpetaShort);
	const jugada = leerJugada(guion);
	const datos = leerDatosVerificados(guion);

	await sharp(archivoPortada)
		.resize({ width: ANCHO_PORTADA })
		.jpeg({ quality: 82, mozjpeg: true })
		.toFile(path.join(destinoPortadas, `${carpeta}.jpg`));
	escritos.add(path.join(destinoPortadas, `${carpeta}.jpg`));

	const frontmatter = [
		'---',
		`numero: ${numero}`,
		`titulo: ${JSON.stringify(sinEmojis(titulo))}`,
		`serie: ${JSON.stringify(serie)}`,
		`portada: ../../assets/piezas/${carpeta}.jpg`,
		`bajada: ${JSON.stringify(leerBajada(publicacion))}`,
		`youtube: ${JSON.stringify(youtube)}`,
		...(jugada ? ['jugada:', `  concepto: ${JSON.stringify(jugada.concepto)}`, `  definicion: ${JSON.stringify(jugada.definicion)}`] : []),
		'narracion:',
		...narracion.map((linea) => `  - ${JSON.stringify(linea)}`),
		'---',
		'',
	];
	// The body is the list of verified facts; Markdown keeps the source links.
	const cuerpo = datos.map(({ dato, fuente }) => `- ${dato} — *${fuente}*`);
	await escribir(path.join(destinoContenido, `${carpeta}.md`), [...frontmatter, ...cuerpo, ''].join('\n'));
	escritas++;

	const nota = await leerNota(path.join(canal, 'pilotos', carpeta, 'nota.md'));
	if (nota && (nota.verificada || conBorradores)) {
		const cabecera = ['---', `titulo: ${JSON.stringify(nota.titulo)}`, `borrador: ${!nota.verificada}`, '---', ''];
		await escribir(path.join(destinoNotas, `${carpeta}.md`), [...cabecera, nota.cuerpo, ''].join('\n'));
		notas.push(`${carpeta}${nota.verificada ? '' : ' (borrador)'}`);
	} else if (nota) {
		notasSinVerificar.push(carpeta);
	}
}

console.log(`${escritas} piezas publicadas sincronizadas desde ${canal}`);
for (const destino of destinos) {
	for (const nombre of await readdir(destino)) {
		const archivo = path.join(destino, nombre);
		if (!escritos.has(archivo)) await rm(archivo);
	}
}

if (notas.length > 0) console.log(`Notas: ${notas.join(', ')}`);
if (notasSinVerificar.length > 0) console.log(`Notas sin verificar (no se publican): ${notasSinVerificar.join(', ')}`);
if (conBorradores) console.log('OJO: corrida con --borradores, solo para ver en local. No commitear.');
const pendientes = estado.piezas.filter((pieza) => pieza.etapa === 'subida' || pieza.etapa === 'programada');
if (pendientes.length > 0) {
	console.log(`Todavía no salen en la web: ${pendientes.map((pieza) => `${pieza.slug} (${pieza.etapa})`).join(', ')}`);
}
