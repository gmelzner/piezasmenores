// Copies the published pieces of the channel into this site: one Markdown
// entry per piece in src/content/piezas and its cover in src/assets/piezas.
// The channel repo is the source of truth; run this after uploading a piece.
//
//   npm run sincronizar            (channel at ../../activos/piezas-menores)
//   PIEZAS_CANAL=/ruta npm run sincronizar
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

const sinEmojis = (texto) => texto.replace(/\p{Extended_Pictographic}|️/gu, '').replace(/\s+/g, ' ').trim();

await mkdir(destinoContenido, { recursive: true });
await mkdir(destinoPortadas, { recursive: true });

const carpetas = (await readdir(subidos, { withFileTypes: true }))
	.filter((entrada) => entrada.isDirectory() && /^\d+-/.test(entrada.name))
	.map((entrada) => entrada.name)
	.sort();

let escritas = 0;
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
		'---',
		'',
	].join('\n');
	await writeFile(path.join(destinoContenido, `${carpeta}.md`), frontmatter);
	escritas++;
}

console.log(`${escritas} piezas sincronizadas desde ${subidos}`);
