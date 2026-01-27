import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, "../src/content/blog");
const ASSETS_DIR = path.join(__dirname, "../src/assets");

// Estilo base para todas las imágenes
const STYLE_PROMPT = `
Minimalist editorial illustration for a blog about chess strategy and business.
Style: Clean, modern, abstract geometric shapes.
Color palette: Black, white, and subtle warm grays with occasional gold accents.
Include subtle chess elements (board patterns, piece silhouettes) integrated elegantly.
Professional, sophisticated look suitable for a strategy/business blog.
No text in the image.
Aspect ratio: 16:9, landscape orientation.
`;

async function generateImage(title, description) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error("❌ Falta GOOGLE_API_KEY en las variables de entorno");
    console.log("   Ejecutá: export GOOGLE_API_KEY='tu-api-key'");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Usar Imagen 3 para generación de imágenes
  const model = genAI.getGenerativeModel({ model: "imagen-3.0-generate-002" });

  const prompt = `${STYLE_PROMPT}\n\nTopic: "${title}"\nContext: ${description}`;

  console.log(`🎨 Generando imagen para: "${title}"`);

  try {
    const result = await model.generateImages({
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "16:9",
      },
    });

    if (result.images && result.images.length > 0) {
      return result.images[0];
    }

    throw new Error("No se generó ninguna imagen");
  } catch (error) {
    console.error(`❌ Error generando imagen: ${error.message}`);
    return null;
  }
}

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Remover comillas
      value = value.replace(/^['"]|['"]$/g, "");
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

async function main() {
  const args = process.argv.slice(2);
  const specificPost = args[0]; // Nombre del post específico (opcional)

  console.log("🚀 Generador de imágenes para Piezas Menores\n");

  // Leer todos los posts
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const slug = file.replace(".md", "");

    // Si se especificó un post, solo procesar ese
    if (specificPost && slug !== specificPost) continue;

    const filePath = path.join(BLOG_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatter = extractFrontmatter(content);

    if (!frontmatter) {
      console.log(`⚠️  Skipping ${file} (no frontmatter)`);
      continue;
    }

    const outputFile = path.join(ASSETS_DIR, `${slug}.jpg`);

    // Verificar si ya existe
    if (fs.existsSync(outputFile) && !args.includes("--force")) {
      console.log(`⏭️  ${slug}: ya existe imagen, saltando (usá --force para regenerar)`);
      continue;
    }

    const image = await generateImage(frontmatter.title, frontmatter.description);

    if (image) {
      // Guardar la imagen
      const imageData = Buffer.from(image.imageBytes, "base64");
      fs.writeFileSync(outputFile, imageData);
      console.log(`✅ Guardada: ${outputFile}\n`);

      // Actualizar el frontmatter del post
      const newHeroImage = `../../assets/${slug}.jpg`;
      const updatedContent = content.replace(
        /heroImage: ['"].*['"]/,
        `heroImage: '${newHeroImage}'`
      );
      fs.writeFileSync(filePath, updatedContent);
      console.log(`📝 Actualizado heroImage en ${file}\n`);
    }
  }

  console.log("✨ Proceso completado");
}

main().catch(console.error);
