import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        watch: {
            // This tells the app to completely ignore Visual Studio's locked files
            ignored: ['**/.vs/**', '**/node_modules/**']
        }
    }
});
