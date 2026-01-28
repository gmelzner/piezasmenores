import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, "../src/content/blog");
const THREADS_DIR = path.join(__dirname, "../threads");

const SITE_URL = "https://piezasmenores.blog";

function getApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("⚠️  Falta ANTHROPIC_API_KEY en las variables de entorno\n");
    console.log("Para generar threads con IA necesitás configurar:");
    console.log("  export ANTHROPIC_API_KEY='tu-api-key'\n");
    console.log("Mientras tanto, se generará un template básico.\n");
    return null;
  }
  return apiKey;
}

function extractFrontmatterAndContent(fileContent) {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatterLines = match[1].split("\n");
  const frontmatter = {};

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      value = value.replace(/^['"]|['"]$/g, "");
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    content: match[2].trim(),
  };
}

function generateBasicTemplate(title, description, content, slug) {
  const url = `${SITE_URL}/blog/${slug}/`;

  // Extract first meaningful paragraphs
  const paragraphs = content
    .split("\n\n")
    .filter((p) => p.trim() && !p.startsWith("#") && !p.startsWith("---"))
    .slice(0, 4);

  return `# Thread para: ${title}

## Tweet 1 (Gancho)
[ESCRIBIR GANCHO BASADO EN EL TÍTULO]

${title}

🧵

## Tweet 2
${paragraphs[0]?.slice(0, 260) || "[Extraer idea principal]"}

## Tweet 3
${paragraphs[1]?.slice(0, 260) || "[Desarrollar la idea]"}

## Tweet 4
${paragraphs[2]?.slice(0, 260) || "[Agregar tensión o pregunta]"}

## Tweet 5 (Cierre + Link)
[PREGUNTA O REFLEXIÓN FINAL]

El análisis completo:
${url}

---

## Tweet Corto (alternativa sin thread)
${description}

${url}

---

## Hashtags sugeridos
#Ajedrez #Estrategia
`;
}

async function generateThreadWithAI(title, description, content, slug, apiKey) {
  const url = `${SITE_URL}/blog/${slug}/`;

  const client = new Anthropic({ apiKey });

  const prompt = `Sos un experto en Twitter/X y marketing de contenidos. Tu tarea es crear un hilo (thread) de 5 tweets para promocionar este artículo de blog.

CONTEXTO DEL BLOG:
- Blog: "Piezas Menores" - sobre ajedrez, estrategia y negocios
- Tono: Inteligente, analítico, sin ser pretencioso
- Audiencia: Argentinos interesados en economía, política y pensamiento estratégico

ARTÍCULO:
Título: ${title}
Descripción: ${description}
URL: ${url}

Contenido:
${content}

INSTRUCCIONES:
1. Tweet 1: Gancho potente que genere curiosidad. NO incluyas el link acá. Terminá con 🧵
2. Tweet 2-4: Desarrollá las ideas más potentes del artículo. Cada tweet debe poder funcionar solo.
3. Tweet 5: Cierre con pregunta o reflexión + el link al artículo
4. Cada tweet máximo 280 caracteres
5. No uses hashtags en el thread (van en respuesta aparte)
6. Mantené el tono del blog: metáforas de ajedrez, análisis frío, sin fanatismo político

También generá:
- Un tweet corto alternativo (para cuando no quiera thread)
- 2-3 hashtags relevantes

Formato de salida:
---
TWEET 1:
[contenido]

TWEET 2:
[contenido]

TWEET 3:
[contenido]

TWEET 4:
[contenido]

TWEET 5:
[contenido]

TWEET CORTO:
[contenido]

HASHTAGS:
[hashtags]
---`;

  console.log("Generando thread con Claude...");

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const response = message.content[0].text;

  return `# Thread para: ${title}

URL: ${url}
Generado: ${new Date().toLocaleDateString("es-AR")}

${response}
`;
}

async function main() {
  const args = process.argv.slice(2);
  const postSlug = args[0];

  if (!postSlug) {
    console.log("Uso: npm run generate-thread <nombre-del-post>\n");
    console.log("Posts disponibles:");
    const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md"));
    files.forEach((f) => console.log(`  - ${f.replace(".md", "")}`));
    process.exit(1);
  }

  const filePath = path.join(BLOG_DIR, `${postSlug}.md`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: No existe el post "${postSlug}"`);
    process.exit(1);
  }

  // Ensure threads directory exists
  if (!fs.existsSync(THREADS_DIR)) {
    fs.mkdirSync(THREADS_DIR, { recursive: true });
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsed = extractFrontmatterAndContent(fileContent);

  if (!parsed) {
    console.error("Error: No se pudo parsear el frontmatter");
    process.exit(1);
  }

  const { frontmatter, content } = parsed;
  const apiKey = getApiKey();

  let threadContent;

  if (apiKey) {
    try {
      threadContent = await generateThreadWithAI(
        frontmatter.title,
        frontmatter.description,
        content,
        postSlug,
        apiKey
      );
    } catch (error) {
      console.error("Error con la API:", error.message);
      console.log("Generando template básico...\n");
      threadContent = generateBasicTemplate(
        frontmatter.title,
        frontmatter.description,
        content,
        postSlug
      );
    }
  } else {
    threadContent = generateBasicTemplate(
      frontmatter.title,
      frontmatter.description,
      content,
      postSlug
    );
  }

  const outputPath = path.join(THREADS_DIR, `${postSlug}.md`);
  fs.writeFileSync(outputPath, threadContent);

  console.log(`✅ Thread guardado en: threads/${postSlug}.md\n`);
  console.log("─".repeat(50));
  console.log(threadContent);
}

main().catch(console.error);
