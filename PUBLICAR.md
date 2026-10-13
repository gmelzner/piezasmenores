# Publicar en Piezas Menores (la web del canal)

La web muestra las piezas que ya se subieron al canal. La fuente de verdad es la
carpeta del canal (`proyectos/activos/piezas-menores`); acá no se carga nada a mano.

## Sumar una pieza nueva

1. En el canal, mover la pieza a `publicar/subidos/NN-slug/` (con `publicacion.md` y `portada.jpg`).
2. En este repo:

   ```sh
   npm run sincronizar   # lee publicar/subidos y regenera src/content/piezas + src/assets/piezas
   npm run build         # verifica que compile
   ```

3. Commit y push a `main`: Vercel despliega solo.

Si la carpeta del canal está en otro lado: `PIEZAS_CANAL=/ruta/al/canal npm run sincronizar`.

## Qué lee de cada pieza

Del `publicacion.md`: la línea `**Título:**` de YouTube Shorts y `Serie:` del encabezado.
La portada se achica a 720 px de ancho. Los emojis del título no pasan a la web.

## Dónde se cambia cada cosa

- Redes, contacto y texto de las series: `src/consts.ts`
- Colores y tipografías: `src/styles/global.css` (misma paleta que `studio/src/comunes/estilo.tsx` del canal)
- Portada: `src/pages/index.astro` · Página del canal: `src/pages/canal.astro`
