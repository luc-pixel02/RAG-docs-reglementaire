# rag-notice-acpr

RAG qui répond à des questions sur une charte réglementaire de l'ACPR (PDF), en se basant uniquement sur le contenu du document. Inclut une suite de tests qui évalue automatiquement la justesse des réponses via un LLM-judge.

Stack : TypeScript/Node, PostgreSQL + pgvector pour le stockage vectoriel, API Gemini pour les embeddings et la génération.

## Installation

```bash
npm install
docker compose up -d
```

`.env` :
```
POSTGRES_PASSWORD=VOTRE_MDP
GEMINI_API_KEY=VOTRE_CLE_API
et autre credentials
```

Créer le schéma (`schema.sql` fourni) :
```bash
docker compose exec -T db psql -U rag -d rag_doc < schema.sql
```
OU

```bash
docker compose exec db psql -U rag -d rag_doc
```
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(3072),
  created_at TIMESTAMP DEFAULT now()
);
```

Mettre le PDF dans `documents/notice.pdf`, puis :
```bash
npx tsx ingest.ts
```

## Usage

```bash
npx tsx query.ts "Combien de membres compose le collège de supervision de l'ACPR ?"
```

## Fichiers

- `ingest.ts` — découpe le PDF en chunks, calcule les vecteurs, insère en base
- `rag.ts`    — le moteur RAG (question -> réponse), utilisé par query.ts et eval.ts
- `query.ts`  — pose une question en ligne de commande
- `eval.ts`   — teste le RAG sur un jeu de questions (`dataset.json`) avec un LLM-judge (GEMINI)

## Note

`eval.ts` marche mais le tier gratuit de Gemini limite `gemini-3.6-flash`
à 20 requêtes/jour, ce qui suffit à peine pour une passe complète sur le
dataset de test.