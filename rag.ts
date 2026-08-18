/**
 * Analyse une question saisie en argument et renvoie la reponse par le biais 
 * dun LLM (Gemini) en utilisant la technique RAG (Retrieval-Augmented Generation).
 * Le LLM ne répond qu'à partir du contexte fourni par les chunks de texte extraits d'un document.
 * 
 * Utilise dans query.ts et eval.ts
 */
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { Client } from "pg";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY manquante dans le .env");

export const ai = new GoogleGenAI({ apiKey });

export async function answerQuestion(
  question: string
): Promise<{ answer: string; chunks: string[] }> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  try {
    // Calcul du vecteur de la question
    const embedResult = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: question,
      config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 3072 },
    });
    const questionEmbedding = embedResult.embeddings?.[0]?.values;
    if (!questionEmbedding) throw new Error("Pas d'embedding généré pour la question");

    // Récupère 5 chunks dont les vecteurs sont le plus proche du vecteur de la question
    const searchResult = await db.query(
      `SELECT content, embedding <=> $1 AS distance
       FROM chunks
       ORDER BY distance ASC
       LIMIT 5`,
      [JSON.stringify(questionEmbedding)]
    );

    const chunks = searchResult.rows.map((r) => r.content);

    // Création du prompt pour Gemini
    const context = chunks.join("\n\n---\n\n");
    const prompt = `Tu es un assistant qui répond uniquement à partir du contexte fourni ci-dessous, extrait d'un document réglementaire ACPR.
Si la réponse ne se trouve pas dans le contexte, dis clairement "Cette information n'est pas présente dans le document."

Contexte :
${context}

Question : ${question}

Réponse :`;

    const genResult = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    return { answer: genResult.text ?? "", chunks };
  } finally {
    await db.end();
  }
}