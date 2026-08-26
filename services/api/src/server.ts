/**
 * Dev entry — aliases the CONNECTED profile so `pnpm dev` / `node src/server.ts`
 * behave exactly as before the profile split. Production images boot a bundled
 * entry-connected.ts or entry-sovereign.ts directly (see Dockerfile.k3s).
 */
import "./entry-connected.ts";
