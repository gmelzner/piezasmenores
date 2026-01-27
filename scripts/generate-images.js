import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, "../src/content/blog");
const ASSETS_DIR = path.join(__dirname, "../src/assets");

const KIE_API_BASE = "https://api.kie.ai/api/v1";

// Estilo base para todas las imágenes
const STYLE_PROMPT = `
Minimalist editorial illustration for a blog about chess strategy and business.
Style: Clean, modern, abstract geometric shapes.
Color palette: Black, white, and subtle warm grays with occasional gold accents.
Include subtle chess elements (board patterns, piece silhouettes) integrated elegantly.
Professional, sophisticated look suitable for a strategy/business blog.
No text in the image.
`;

function getApiKey() {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    console.error("Falta KIE_API_KEY en las variables de entorno");
    console.log("   Ejecuta: export KIE_API_KEY='tu-api-key'");
    console.log("   Obtene tu key en: https://kie.ai/api-key");
    process.exit(1);
  }
  return apiKey;
}

async function submitImageTask(prompt, apiKey) {
  const response = await fetch(`${KIE_API_BASE}/flux/kontext/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspectRatio: "16:9",
      outputFormat: "jpeg",
      model: "flux-kontext-pro",
      enableTranslation: true,
    }),
  });

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`Error al crear tarea: ${data.msg || JSON.stringify(data)}`);
  }

  return data.data.taskId;
}

async function pollForResult(taskId, apiKey) {
  const maxAttempts = 60; // 5 minutos max (60 * 5s)
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(
      `${KIE_API_BASE}/flux/kontext/record-info?taskId=${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const data = await response.json();

    if (data.code !== 200) {
      throw new Error(`Error al consultar tarea: ${data.msg}`);
    }

    const { successFlag } = data.data;

    if (successFlag === 1) {
      // Exito
      return data.data.response.resultImageUrl;
    } else if (successFlag === 2 || successFlag === 3) {
      // Fallo
      throw new Error(
        `Fallo la generacion: ${data.data.errorMessage || "error desconocido"}`
      );
    }

    // successFlag === 0 -> sigue generando
    process.stdout.write(".");
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("Timeout: la imagen tardo mas de 5 minutos");
}

async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error descargando imagen: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

async function generateImage(title, description, apiKey) {
  const prompt = `${STYLE_PROMPT}\nTopic: "${title}"\nContext: ${description}`;

  console.log(`\nGenerando imagen para: "${title}"`);

  // 1. Enviar tarea
  const taskId = await submitImageTask(prompt, apiKey);
  console.log(`  Tarea creada: ${taskId}`);
  process.stdout.write("  Esperando");

  // 2. Esperar resultado
  const imageUrl = await pollForResult(taskId, apiKey);
  console.log("\n  Imagen lista");

  return imageUrl;
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
      value = value.replace(/^['"]|['"]$/g, "");
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

async function main() {
  const args = process.argv.slice(2);
  const specificPost = args.find((a) => !a.startsWith("--"));
  const force = args.includes("--force");

  const apiKey = getApiKey();

  console.log("Generador de imagenes - Piezas Menores (Kie.ai / Flux Kontext)\n");

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
  let generated = 0;

  for (const file of files) {
    const slug = file.replace(".md", "");

    if (specificPost && slug !== specificPost) continue;

    const filePath = path.join(BLOG_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatter = extractFrontmatter(content);

    if (!frontmatter) {
      console.log(`Saltando ${file} (sin frontmatter)`);
      continue;
    }

    const outputFile = path.join(ASSETS_DIR, `${slug}.jpg`);

    if (fs.existsSync(outputFile) && !force) {
      console.log(`Saltando ${slug}: ya existe (usa --force para regenerar)`);
      continue;
    }

    try {
      const imageUrl = await generateImage(
        frontmatter.title,
        frontmatter.description,
        apiKey
      );

      // 3. Descargar imagen
      await downloadImage(imageUrl, outputFile);
      console.log(`  Guardada: src/assets/${slug}.jpg`);

      // 4. Actualizar frontmatter
      const newHeroImage = `../../assets/${slug}.jpg`;
      const updatedContent = content.replace(
        /heroImage: ['"].*['"]/,
        `heroImage: '${newHeroImage}'`
      );
      fs.writeFileSync(filePath, updatedContent);
      console.log(`  Actualizado heroImage en ${file}`);
      generated++;
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
  }

  console.log(`\nListo. ${generated} imagen(es) generada(s).`);
}

main().catch(console.error);
