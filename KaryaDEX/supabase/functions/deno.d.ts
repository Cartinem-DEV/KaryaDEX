// Ambient type definitions for Supabase Edge Functions (Deno Runtime)

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    has(key: string): boolean;
  }
  export const env: Env;
  export function serve(
    handler: (req: Request) => Promise<Response> | Response
  ): void;
  export function serve(
    options: { port?: number; onListen?: (params: { port: number; hostname: string }) => void },
    handler: (req: Request) => Promise<Response> | Response
  ): void;
}

declare module 'https://*' {
  export const createClient: any;
  export const serve: any;
  const content: any;
  export default content;
}
