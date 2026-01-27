# Publicar un nuevo artículo en Piezas Menores

## 1. Crear el archivo

Crear un archivo `.md` en `src/content/blog/` con el nombre en formato slug:
- Todo minúscula, sin acentos, palabras separadas por guiones
- Ejemplo: `el-gambito-de-dama-en-los-negocios.md`

## 2. Formato del artículo

```markdown
---
title: 'Título del artículo'
description: 'Descripción corta (1-2 oraciones) para SEO y listados.'
pubDate: 'Jan 27 2026'
heroImage: '../../assets/nombre-del-archivo.jpg'
---

Contenido en Markdown.

**Negritas** para énfasis. *Cursivas* para citas o matices.

## Subtítulos con ##

Listas con guiones:
- Punto 1
- Punto 2

Listas numeradas:
1. Paso 1
2. Paso 2

---

*Cierre en cursiva con reflexión final.*
```

### Campos del frontmatter

| Campo | Requerido | Formato | Ejemplo |
|-------|-----------|---------|---------|
| `title` | Si | String entre comillas | `'Zugzwang: cuando no mover es perder'` |
| `description` | Si | String entre comillas, 1-2 oraciones | `'Un concepto de ajedrez que explica muchas crisis.'` |
| `pubDate` | Si | Fecha en inglés | `'Jan 27 2026'` |
| `heroImage` | No | Path relativo a assets | `'../../assets/mi-post.jpg'` |
| `updatedDate` | No | Fecha en inglés | `'Feb 01 2026'` |

## 3. Generar la imagen

```bash
export KIE_API_KEY='tu-api-key'
npm run generate-images nombre-del-post
```

Opciones:
- `npm run generate-images` - genera imágenes para TODOS los posts sin imagen
- `npm run generate-images mi-post` - genera solo para ese post
- `npm run generate-images mi-post --force` - regenera aunque ya exista

El script actualiza automáticamente el campo `heroImage` en el frontmatter.

## 4. Deploy

```bash
git add .
git commit -m "Nuevo post: título del artículo"
git push
```

Vercel auto-deploya al hacer push a main.
