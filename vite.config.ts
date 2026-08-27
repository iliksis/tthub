/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitroV2Plugin } from '@tanstack/nitro-v2-vite-plugin'
import mkcert from 'vite-plugin-mkcert'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

const config = defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
	mkcert(),
    // `injectSource` adds a `data-tsd-source` attribute to every JSX element
    // for the devtools "click to open in editor" inspector. It was leaking
    // into the URL as a stray search param on this route, so it's disabled.
    devtools({ injectSource: { enabled: false } }),
    nitroV2Plugin(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['cookie', 'baseLocale'],
      cookieName: 'PARAGLIDE_LOCALE',
    }),
    tanstackStart(),
    viteReact(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'e2e/**', 'playwright/.auth/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/routeTree.gen.ts',
        'src/lib/prisma/**',
        'src/paraglide/**',
      ],
    },
  },
})

export default config
