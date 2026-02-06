/**
 * Cache Busting Tests
 * 
 * These tests verify that the Vite build process generates content-hashed
 * filenames for static assets to prevent browser caching issues.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.7
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Cache Busting', () => {
    const distPath = join(__dirname, '../../dist');
    const assetsPath = join(distPath, 'assets');

    describe('Content-Hashed Filenames', () => {
        it('should generate hashed filenames for JavaScript files', () => {
            // Requirement 16.1: Build process SHALL generate content-hashed filenames
            const files = readdirSync(assetsPath);
            const jsFiles = files.filter(f => f.endsWith('.js'));

            expect(jsFiles.length).toBeGreaterThan(0);

            // Verify each JS file has a hash in the format: name.[hash].js
            // Name can contain dots, dashes, and underscores
            jsFiles.forEach(file => {
                const hashPattern = /^[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+\.js$/;
                expect(file).toMatch(hashPattern);
            });
        });

        it('should generate hashed filenames for CSS files', () => {
            // Requirement 16.1: Build process SHALL generate content-hashed filenames
            const files = readdirSync(assetsPath);
            const cssFiles = files.filter(f => f.endsWith('.css'));

            expect(cssFiles.length).toBeGreaterThan(0);

            // Verify each CSS file has a hash in the format: name.[hash].css
            // Name can contain dots, dashes, and underscores
            cssFiles.forEach(file => {
                const hashPattern = /^[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+\.css$/;
                expect(file).toMatch(hashPattern);
            });
        });

        it('should generate different hashes for different content', () => {
            // Requirement 16.2: WHEN content changes, SHALL generate new filename with different hash
            const files = readdirSync(assetsPath);
            const jsFiles = files.filter(f => f.endsWith('.js'));

            // Extract hashes from filenames
            const hashes = jsFiles.map(file => {
                const match = file.match(/\.([a-zA-Z0-9_-]+)\.js$/);
                return match ? match[1] : null;
            }).filter(Boolean);

            // Verify all hashes are unique (no duplicate hashes)
            const uniqueHashes = new Set(hashes);
            expect(uniqueHashes.size).toBe(hashes.length);
        });
    });

    describe('HTML References', () => {
        it('should reference hashed filenames in index.html', () => {
            // Requirement 16.3: Build process SHALL automatically update HTML references
            const indexHtml = readFileSync(join(distPath, 'index.html'), 'utf-8');

            // Check for script tags with hashed filenames
            const scriptPattern = /<script[^>]+src="\/assets\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.js"/;
            expect(indexHtml).toMatch(scriptPattern);

            // Check for link tags with hashed filenames
            const linkPattern = /<link[^>]+href="\/assets\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.css"/;
            expect(indexHtml).toMatch(linkPattern);
        });

        it('should not contain unhashed asset references', () => {
            // Requirement 16.3: Build process SHALL automatically update HTML references
            const indexHtml = readFileSync(join(distPath, 'index.html'), 'utf-8');

            // Verify no references to main.js or index.js without hashes
            expect(indexHtml).not.toContain('src="/main.js"');
            expect(indexHtml).not.toContain('src="/index.js"');
            expect(indexHtml).not.toContain('href="/main.css"');
            expect(indexHtml).not.toContain('href="/index.css"');
        });
    });

    describe('Asset Types', () => {
        it('should apply content hashing to all asset types', () => {
            // Requirement 16.7: Build process SHALL apply content hashing to all imported assets
            const files = readdirSync(assetsPath);

            // Check for various asset types with hashes
            const assetTypes = ['.js', '.css', '.png', '.jpg', '.svg', '.woff', '.woff2'];

            assetTypes.forEach(ext => {
                const assetsOfType = files.filter(f => f.endsWith(ext));

                if (assetsOfType.length > 0) {
                    // Verify each asset has a hash
                    assetsOfType.forEach(file => {
                        const parts = file.split('.');
                        // Format: name.hash.ext or name.hash.hash.ext (for double extensions)
                        expect(parts.length).toBeGreaterThanOrEqual(3);
                    });
                }
            });
        });
    });

    describe('Build Output Verification', () => {
        it('should have assets directory with hashed files', () => {
            // Requirement 16.6: Deployment SHALL verify new asset filenames are present
            const files = readdirSync(assetsPath);

            expect(files.length).toBeGreaterThan(0);

            // Verify at least one JS and one CSS file exists
            const hasJs = files.some(f => f.endsWith('.js'));
            const hasCss = files.some(f => f.endsWith('.css'));

            expect(hasJs).toBe(true);
            expect(hasCss).toBe(true);
        });

        it('should have index.html in dist root', () => {
            // Requirement 16.6: Deployment SHALL verify new asset filenames are present
            const files = readdirSync(distPath);

            expect(files).toContain('index.html');
        });
    });
});
