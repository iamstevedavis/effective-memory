# effective-memory

Reviews → Social MVP scaffold.

## Local dev quickstart

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run dev
# in another terminal
npx ts-node worker/index.ts
```

Or run everything in containers:

```bash
cp .env.example .env
docker compose up --build
```
