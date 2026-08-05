import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Same virtual-module resolution rollup.config.js uses for a real build, so
// tests import the real src/Toasts.ts unmodified rather than a mocked copy.
function css() {
    return {
        name: 'css-to-string',
        transform(code: string, id: string) {
            if (!id.endsWith('.css')) return null;
            return { code: `export default ${JSON.stringify(code)};`, map: null };
        }
    };
}

function version() {
    return {
        name: 'version-virtual-module',
        resolveId(id: string) {
            return id === 'virtual:version' ? id : null;
        },
        load(id: string) {
            if (id === 'virtual:version') return `export default ${JSON.stringify(pkg.version)};`;
        }
    };
}

export default defineConfig({
    plugins: [css(), version()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./test/setup.ts'],
        include: ['test/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts']
        }
    }
});
