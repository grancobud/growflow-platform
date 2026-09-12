/// <reference types="vite/client" />

// Los .md se importan como texto con ?raw. El manual vive en
// src/contenido/manual.md y se renderiza desde PaginaManual.
declare module '*.md?raw' {
  const contenido: string
  export default contenido
}
