/// <reference types="vite/client" />

declare module '*?worker' {
  const Worker: { new (): Worker };
  export default Worker;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
