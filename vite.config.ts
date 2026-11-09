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

let uncaughtHandlerInstalled = false

const config = defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [
	// Unit tests don't serve HTTPS; skipping it avoids mkcert's GitHub API
	// download (rate-limited on shared CI runners) failing vitest startup.
	...(process.env.VITEST ? [] : [mkcert()]),
    {
      // The dev server (HTTP/2 via mkcert) throws an uncaught
      // ERR_HTTP2_INVALID_STREAM when a client disconnects before the SSR
      // response is written, killing the whole process (and every later e2e
      // test with ERR_CONNECTION_REFUSED). A dropped connection is harmless,
      // so ignore only that error and keep the default crash for the rest.
      name: 'ignore-destroyed-http2-stream',
      apply: 'serve',
      configureServer() {
        // configureServer reruns on dev-server restarts; register only once.
        if (uncaughtHandlerInstalled) return
        uncaughtHandlerInstalled = true
        process.on('uncaughtException', (error) => {
          if ((error as NodeJS.ErrnoException).code === 'ERR_HTTP2_INVALID_STREAM') return
          console.error(error)
          process.exit(1)
        })
      },
    },
    // `injectSource` adds a `data-tsd-source` attribute to every JSX element
    // for the devtools "click to open in editor" inspector. It was leaking
    // into the URL as a stray search param on this route, so it's disabled.
    devtools({ injectSource: { enabled: false } }),
    // Nitro loads the SSR entry lazily on the first request; this boot plugin
    // loads it at startup so the nightly statistics job is scheduled right away.
    nitroV2Plugin({ plugins: ['./server/plugins/statisticsRefresh.ts'] }),
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
    // Import protection mocks `*.server.*` modules in Vitest's (client-like)
    // environment, which hangs any test importing an API class. The build
    // keeps the guard, so a client import of a `.server` file still fails CI.
    tanstackStart(
      process.env.VITEST ? { importProtection: { enabled: false } } : undefined,
    ),
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
