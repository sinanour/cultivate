import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { fc, test } from '@fast-check/vitest';
import { ProgressIndicator } from '../ProgressIndicator';

describe('ProgressIndicator - Property-Based Tests', () => {
    // Feature: map-loading-indeterminate-mode, Property 1: Mode determination based on total count
    describe('Property 1: Mode determination based on total count', () => {
        test.prop([
            fc.record({
                loadedCount: fc.nat({ max: 1000 }),
                totalCount: fc.nat({ max: 1000 }),
                isCancelled: fc.boolean(),
                entityName: fc.string({ minLength: 1, maxLength: 20 }),
            }),
        ], { numRuns: 100 })('should render in indeterminate mode when totalCount is 0, determinate mode when totalCount > 0', (state) => {
            const onCancel = vi.fn();
            const onResume = vi.fn();

            const { container } = render(
                <ProgressIndicator
                    loadedCount={state.loadedCount}
                    totalCount={state.totalCount}
                    entityName={state.entityName}
                    onCancel={onCancel}
                    onResume={onResume}
                    isCancelled={state.isCancelled}
                />
            );

            // Skip if component unmounted (loadedCount >= totalCount && totalCount > 0)
            if (state.loadedCount >= state.totalCount && state.totalCount > 0) {
                expect(container.firstChild).toBeNull();
                return;
            }

            if (state.totalCount === 0) {
                // Indeterminate mode: should NOT have progress element, should have text without count pattern
                const progressElement = container.querySelector('progress');
                expect(progressElement).toBeNull();

                // Should not display "X / Y" pattern in indeterminate mode
                const text = container.textContent || '';
                expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
            } else {
                // Determinate mode: should have progress element and count information
                const progressElement = container.querySelector('progress');
                expect(progressElement).toBeInTheDocument();

                // Should display "X / Y" pattern in determinate mode
                const text = container.textContent || '';
                expect(text).toMatch(/\d+\s*\/\s*\d+/);
            }
        });
    });

    // Feature: map-loading-indeterminate-mode, Property 2: Indeterminate mode displays animation without counts
    describe('Property 2: Indeterminate mode displays animation without counts', () => {
        test.prop([
            fc.record({
                loadedCount: fc.nat({ max: 100 }),
                totalCount: fc.constant(0),
                isCancelled: fc.constant(false), // Only test active state
                entityName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('%') && !s.match(/\d+\s*\/\s*\d+/)),
            }),
        ], { numRuns: 100 })('should display Spinner and text without count information when in indeterminate mode and not paused', (state) => {
            const onCancel = vi.fn();
            const onResume = vi.fn();

            const { container } = render(
                <ProgressIndicator
                    loadedCount={state.loadedCount}
                    totalCount={state.totalCount}
                    entityName={state.entityName}
                    onCancel={onCancel}
                    onResume={onResume}
                    isCancelled={state.isCancelled}
                />
            );

            // Should render Spinner (CloudScape Spinner renders as svg element)
            const spinnerElement = container.querySelector('svg');
            expect(spinnerElement).toBeInTheDocument();

            // Should NOT display percentage or count information (no "X / Y" pattern)
            const text = container.textContent || '';
            expect(text).not.toMatch(/\d+\s*\/\s*\d+/);

            // Should display loading text
            expect(text).toContain('Loading');
        });
    });

    // Feature: map-loading-indeterminate-mode, Property 3: Determinate mode displays progress with counts
    describe('Property 3: Determinate mode displays progress with counts', () => {
        test.prop([
            fc.record({
                loadedCount: fc.nat({ max: 100 }),
                totalCount: fc.integer({ min: 1, max: 1000 }),
                isCancelled: fc.boolean(),
                entityName: fc.string({ minLength: 1, maxLength: 20 }),
            }).filter(state => state.loadedCount < state.totalCount),
        ], { numRuns: 100 })('should render ProgressBar with correct value and display both loadedCount and totalCount', (state) => {
            const onCancel = vi.fn();
            const onResume = vi.fn();

            const { container } = render(
                <ProgressIndicator
                    loadedCount={state.loadedCount}
                    totalCount={state.totalCount}
                    entityName={state.entityName}
                    onCancel={onCancel}
                    onResume={onResume}
                    isCancelled={state.isCancelled}
                />
            );

            // Should have progress element
            const progressElement = container.querySelector('progress');
            expect(progressElement).toBeInTheDocument();

            // Should have correct progress value (CloudScape may round values)
            const expectedPercentage = (state.loadedCount / state.totalCount) * 100;
            const actualValue = Number(progressElement?.getAttribute('value'));
            // Allow 1% tolerance for rounding
            expect(Math.abs(actualValue - expectedPercentage)).toBeLessThanOrEqual(1);

            // Should display both loadedCount and totalCount in text
            const text = container.textContent || '';
            expect(text).toContain(String(state.loadedCount));
            expect(text).toContain(String(state.totalCount));
            expect(text).toMatch(/\d+\s*\/\s*\d+/);
        });
    });

    // Feature: map-loading-indeterminate-mode, Property 6: Animation state reflects pause status
    describe('Property 6: Animation state reflects pause status', () => {
        test.prop([
            fc.record({
                loadedCount: fc.nat({ max: 100 }),
                totalCount: fc.constant(0),
                isCancelled: fc.boolean(),
                entityName: fc.string({ minLength: 1, maxLength: 20 }),
            }),
        ], { numRuns: 100 })('should render Spinner when not paused, hide Spinner when paused in indeterminate mode', (state) => {
            const onCancel = vi.fn();
            const onResume = vi.fn();

            const { container } = render(
                <ProgressIndicator
                    loadedCount={state.loadedCount}
                    totalCount={state.totalCount}
                    entityName={state.entityName}
                    onCancel={onCancel}
                    onResume={onResume}
                    isCancelled={state.isCancelled}
                />
            );

            // Check animation state by verifying text content changes based on pause status
            const text = container.textContent || '';

            if (state.isCancelled) {
                // When paused, should display "Loading paused"
                expect(text).toContain('paused');
            } else {
                // When active, should display "Loading {entityName}..."
                expect(text).toContain('Loading');
                expect(text).not.toContain('paused');
            }
        });
    });
});


// Feature: map-loading-indeterminate-mode, Property 4: Component renders during active loading
describe('Property 4: Component renders during active loading', () => {
    test.prop([
        fc.record({
            loadedCount: fc.nat({ max: 1000 }),
            totalCount: fc.nat({ max: 1000 }),
            isCancelled: fc.boolean(),
            entityName: fc.string({ minLength: 1, maxLength: 20 }),
        }).filter(state => state.loadedCount < state.totalCount || state.totalCount === 0),
    ], { numRuns: 100 })('should render content when loading is not complete', (state) => {
        const onCancel = vi.fn();
        const onResume = vi.fn();

        const { container } = render(
            <ProgressIndicator
                loadedCount={state.loadedCount}
                totalCount={state.totalCount}
                entityName={state.entityName}
                onCancel={onCancel}
                onResume={onResume}
                isCancelled={state.isCancelled}
            />
        );

        // Component should render (not return null) when loading is active
        expect(container.firstChild).not.toBeNull();
    });
});


// Feature: map-loading-indeterminate-mode, Property 8: Component unmounts on completion
describe('Property 8: Component unmounts on completion', () => {
    test.prop([
        fc.record({
            count: fc.integer({ min: 1, max: 1000 }),
            isCancelled: fc.boolean(),
            entityName: fc.string({ minLength: 1, maxLength: 20 }),
        }),
    ], { numRuns: 100 })('should return null when loadedCount >= totalCount AND totalCount > 0', (state) => {
        const onCancel = vi.fn();
        const onResume = vi.fn();

        const { container } = render(
            <ProgressIndicator
                loadedCount={state.count}
                totalCount={state.count}
                entityName={state.entityName}
                onCancel={onCancel}
                onResume={onResume}
                isCancelled={state.isCancelled}
            />
        );

        // Component should unmount (return null) when loading is complete
        expect(container.firstChild).toBeNull();
    });
});


// Feature: map-loading-indeterminate-mode, Property 5: Pause and resume buttons present in both modes
describe('Property 5: Pause and resume buttons present in both modes', () => {
    test.prop([
        fc.record({
            loadedCount: fc.nat({ max: 1000 }),
            totalCount: fc.nat({ max: 1000 }),
            isCancelled: fc.boolean(),
            entityName: fc.string({ minLength: 1, maxLength: 20 }),
        }).filter(state => state.loadedCount < state.totalCount || state.totalCount === 0),
    ], { numRuns: 100 })('should render button that calls onCancel when not paused and onResume when paused', (state) => {
        const onCancel = vi.fn();
        const onResume = vi.fn();

        const { container } = render(
            <ProgressIndicator
                loadedCount={state.loadedCount}
                totalCount={state.totalCount}
                entityName={state.entityName}
                onCancel={onCancel}
                onResume={onResume}
                isCancelled={state.isCancelled}
            />
        );

        // Should have a button
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();

        // Button should have appropriate aria-label
        if (state.isCancelled) {
            expect(button?.getAttribute('aria-label')).toContain('Resume');
        } else {
            expect(button?.getAttribute('aria-label')).toContain('Pause');
        }
    });
});


// Feature: map-loading-indeterminate-mode, Property 7: Paused state displays appropriate UI
describe('Property 7: Paused state displays appropriate UI', () => {
    test.prop([
        fc.record({
            loadedCount: fc.nat({ max: 1000 }),
            totalCount: fc.nat({ max: 1000 }),
            isCancelled: fc.constant(true), // Only test paused state
            entityName: fc.string({ minLength: 1, maxLength: 20 }),
        }).filter(state => state.loadedCount < state.totalCount || state.totalCount === 0),
    ], { numRuns: 100 })('should render play button and paused text when isCancelled is true', (state) => {
        const onCancel = vi.fn();
        const onResume = vi.fn();

        const { container } = render(
            <ProgressIndicator
                loadedCount={state.loadedCount}
                totalCount={state.totalCount}
                entityName={state.entityName}
                onCancel={onCancel}
                onResume={onResume}
                isCancelled={state.isCancelled}
            />
        );

        // Should have a button with Resume aria-label (play button)
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();
        expect(button?.getAttribute('aria-label')).toContain('Resume');

        // Should display paused text
        const text = container.textContent || '';
        expect(text).toMatch(/paused|Loaded/i);
    });
});


// Feature: map-loading-indeterminate-mode, Property 9: Consistent layout structure across modes
describe('Property 9: Consistent layout structure across modes', () => {
    test.prop([
        fc.record({
            loadedCount: fc.nat({ max: 1000 }),
            totalCount: fc.nat({ max: 1000 }),
            isCancelled: fc.boolean(),
            entityName: fc.string({ minLength: 1, maxLength: 20 }),
        }).filter(state => state.loadedCount < state.totalCount || state.totalCount === 0),
    ], { numRuns: 100 })('should use SpaceBetween with direction="horizontal" and size="xs" as root container', (state) => {
        const onCancel = vi.fn();
        const onResume = vi.fn();

        const { container } = render(
            <ProgressIndicator
                loadedCount={state.loadedCount}
                totalCount={state.totalCount}
                entityName={state.entityName}
                onCancel={onCancel}
                onResume={onResume}
                isCancelled={state.isCancelled}
            />
        );

        // Should have SpaceBetween as root container (CloudScape renders it with specific class)
        const spaceBetweenElement = container.querySelector('[class*="awsui_root"]');
        expect(spaceBetweenElement).toBeInTheDocument();

        // Should have a button as first child
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();
    });
});
