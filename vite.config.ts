import { defineConfig } from 'vitest/config'
import { contentPlugin } from './build/content.js'
import { staticPagesPlugin } from './build/static-pages.js'
import site from './site.config.js'

export default defineConfig({
  // A project site lives under /<repo>/. The Pages workflow sets this rather
  // than committing a base that would be wrong for every other deploy target.
  base: process.env.PROSEOS_BASE ?? site.base,
  plugins: [contentPlugin(), staticPagesPlugin()],
  build: {
    target: 'es2022',
    cssTarget: 'chrome111',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // One chunk per document. Naming them after the slug would put the
        // archive's table of contents in the network tab and break on any
        // slug a filesystem dislikes, so they are all `doc-<hash>.js`.
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId?.includes('virtual:proseos/doc/')
            ? 'assets/doc-[hash].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    // This box has under 1 GB of RAM. One reused worker keeps the suite inside
    // it; the default worker-per-file pool does not.
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    fileParallelism: false,
  },
})
