/**
 * Extraction du contenu du PDF en differents chunks et vectorisation dans la base de données (table chunks)
 */
import "dotenv/config";
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import { Client } from "pg";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("ERREUR ; cle API GEMINI manquante");

const ai = new GoogleGenAI({ apiKey });

const db = new Client({ connectionString: process.env.DATABASE_URL });

// Decoupage du texte brut en plusieurs sous texte avec superposition
function chunkText(text: string, size = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const chunk = text.slice(start, start + size).trim();
    if (chunk) chunks.push(chunk);
    if (start + size >= text.length) break;
    start += size - overlap;
  }
  return chunks;
}

async function main() {
  console.log("Debut traitement PDF");
  // extraction du texte du PDF
  const buffer = fs.readFileSync("documents/notice.pdf");
  const parser = new PDFParse({ data: buffer });
  let rawText: string;
  try {
    const data = await parser.getText();
    rawText = data.text;
  } finally {
    await parser.destroy();
  }

  console.log(`Texte extrait : ${rawText.length} caractères`);

  const chunks = chunkText(rawText);
  console.log(`Découpé en ${chunks.length} chunks`);

  await db.connect();
  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;

      // Calcul vecteur du chunk
      const result = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: chunk,
        config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 3072 },
      });
      const embedding = result.embeddings?.[0]?.values;
      if (!embedding) throw new Error(`Pas d'embedding renvoyé pour le chunk ${i}`);

      // Insertion BD du texte et de son vecteur
      await db.query("INSERT INTO chunks (content, embedding) VALUES ($1, $2)", [
        chunk,
        JSON.stringify(embedding),
      ]);

      console.log(`Chunk ${i + 1}/${chunks.length} inséré`);
    }
  } finally {
    await db.end();
  }

  console.log("Fin vectorisation PDF");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});