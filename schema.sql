CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(3072),
  created_at TIMESTAMP DEFAULT now()
);