/**
 * L'objectif est de tester la cohérence des résultats obtenus avec le RAG.
 * Pour cela, usage d'un jeu de données de test avec des questions et réponses attendues,
 * et interprétation par un LLM (Gemini).
 * Cependant, nombre de requêtes limité dans le tier gratuit de l'API Gemini = tests limites
 */
 
import "dotenv/config";
import fs from "fs";
import { ai, answerQuestion } from "./rag.js";

interface EvalItem {
  question: string;
  expected: string;
}

const dataset: EvalItem[] = JSON.parse(fs.readFileSync("dataset.json", "utf-8"));

// LLM JUDGE
async function judge(
  question: string,
  expected: string,
  generated: string
): Promise<{ verdict: "CORRECT" | "INCORRECT" | "PARTIEL"; justification: string }> {
  const prompt = `Tu es un évaluateur strict. Compare la réponse générée à la réponse de référence pour la question donnée.

Question : ${question}

Réponse de référence : ${expected}

Réponse générée par le système : ${generated}

La réponse générée est-elle correcte par rapport à la référence ? Réponds UNIQUEMENT avec un JSON strict, sans texte autour, au format :
{"verdict": "CORRECT" | "INCORRECT" | "PARTIEL", "justification": "une phrase courte expliquant pourquoi"}`;

  const result = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  const text = (result.text ?? "").trim();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function main() {
  const results: Array<{
    question: string;
    expected: string;
    generated: string;
    verdict: string;
    justification: string;
  }> = [];

  for (const [i, item] of dataset.entries()) {
    console.log(`\n[${i + 1}/${dataset.length}] ${item.question}`);

    const { answer } = await answerQuestion(item.question);
    const { verdict, justification } = await judge(item.question, item.expected, answer);

    console.log(`  Réponse générée : ${answer.slice(0, 100)}...`);
    console.log(`  Verdict : ${verdict} — ${justification}`);

    results.push({ ...item, generated: answer, verdict, justification });
  }

  const correct = results.filter((r) => r.verdict === "CORRECT").length;
  const partial = results.filter((r) => r.verdict === "PARTIEL").length;
  const incorrect = results.filter((r) => r.verdict === "INCORRECT").length;

  console.log("\n=== RESULTATS ===");
  console.log(`Correct : ${correct}/${results.length}`);
  console.log(`Partiel : ${partial}/${results.length}`);
  console.log(`Incorrect : ${incorrect}/${results.length}`);
  console.log(`Taux de réussite : ${((correct / results.length) * 100).toFixed(1)}%`);

  fs.writeFileSync("eval-results.json", JSON.stringify(results, null, 2));
}

main().catch(console.error);