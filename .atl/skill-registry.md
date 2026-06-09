# Skill Registry — encuestas

> Greenfield. No hay skills propios del proyecto todavía. Este registro lista las reglas
> del ecosistema que aplican y que el orquestador inyecta como `## Project Standards` en
> cada sub-agente.

## Compact Rules (auto-resueltas)

### Global (Gentleman / CLAUDE.md)
- Conventional commits. NUNCA "Co-Authored-By" ni atribución de IA en commits.
- Usar `rg`/`fd`/`bat`/`sd`/`eza` en vez de grep/find/cat/sed/ls.
- Respuestas cortas por defecto; una pregunta a la vez.
- Verificar afirmaciones técnicas antes de afirmarlas.
- Clean/Hexagonal/Screaming Architecture, container-presentational, atomic design.

### Stack objetivo (se activan al tocar código)
- `vercel:nextjs` — Next.js App Router (Server Components, Server Actions, routing).
- `vercel:vercel-storage` — Neon Postgres via Marketplace.
- `vercel:auth` — Clerk (si se elige auth real para admin).
- `vercel:shadcn` — componentes UI del panel admin.
- `vercel:react-best-practices` — revisión tras editar varios .tsx.
- `vercel:deployments-cicd` / `vercel:bootstrap` — provisión y deploy.

## User Skills (trigger table)
_(ninguno propio del proyecto aún)_

## Testing
- Strict TDD: activo (marker de entorno). Runner aún no existe; se definirá al scaffoldear
  (probable Vitest unit + Playwright e2e). TDD aplica desde el primer código.
