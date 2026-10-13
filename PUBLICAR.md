# Publicar en Piezas Menores (la web del canal)

La web muestra las piezas que ya se subieron al canal. La fuente de verdad es la
carpeta del canal (`proyectos/activos/piezas-menores`); acá no se carga nada a mano.

## Sumar una pieza nueva

1. En el canal, mover la pieza a `publicar/subidos/NN-slug/` (con `publicacion.md` y `portada.jpg`).
2. En el canal, anotar el video de YouTube:

   ```sh
   herramientas/estado.py anotar NN --youtube ID                       # ya es público
   herramientas/estado.py anotar NN --youtube ID --publica 2026-10-20T18:00   # quedó programado
   ```

   El ID es lo que va después de `youtube.com/shorts/`.
3. En este repo:

   ```sh
   npm run sincronizar   # refresca el estado del canal y regenera src/content/piezas + src/assets/piezas
   npm run build         # verifica que compile
   ```

4. Commit y push a `main`: Vercel despliega solo.

**La web muestra solo las piezas en etapa `publicada`**: subidas, con id anotado y con la fecha de
salida ya cumplida. Una pieza programada aparece la primera vez que se corre `npm run sincronizar`
después de su salida (el sitio es estático: no se actualiza solo al llegar la hora).

Si la carpeta del canal está en otro lado: `PIEZAS_CANAL=/ruta/al/canal npm run sincronizar`.

## Qué lee de cada pieza

- `estado.json` (lo genera `herramientas/estado.py`): etapa, título, serie e id de YouTube.
- `publicar/subidos/NN-slug/publicacion.md`: el primer párrafo de la descripción (la bajada de la página).
- `publicar/subidos/NN-slug/portada.jpg`: se achica a 720 px de ancho.
- `pilotos/NN-slug/short-01/narracion*.txt`: el texto de la pieza (si hay varias versiones, la última).
- `pilotos/NN-slug/short-01/guion-short.md`: la línea `- **La jugada:** Concepto — definición` y la
  tabla de verificación.

De la tabla de verificación **solo se publican las filas con ✅ y una fuente pública** (o `✅ cálculo`).
Quedan afuera las ❌, las ⚠️, las `✅ media` y las que tienen como fuente `agente` o `—`. Lo que va
después de ` → ` en la columna Dato es una nota interna y tampoco se publica.

## Dónde se cambia cada cosa

- Redes, contacto y texto de las series: `src/consts.ts`
- Colores y tipografías: `src/styles/global.css` (misma paleta que `studio/src/comunes/estilo.tsx` del canal)
- Portada: `src/pages/index.astro` · Página del canal: `src/pages/canal.astro` · Página de cada pieza: `src/pages/piezas/[slug].astro`
