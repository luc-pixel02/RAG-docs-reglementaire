import { answerQuestion } from "./rag.js";

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('Usage: npx tsx query.ts "Question ici"');
  process.exit(1);
}

answerQuestion(question).then(({ answer, chunks }) => {
  console.log(answer);
});