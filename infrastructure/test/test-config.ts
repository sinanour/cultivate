/**
 * Test configuration utilities
 */

/**
 * Get the number of property-based test runs from environment or use default
 * Set PBT_RUNS environment variable to override (e.g., PBT_RUNS=10 npm test)
 */
export function getNumRuns(): number {
  const envRuns = process.env.PBT_RUNS;
  if (envRuns) {
    const parsed = parseInt(envRuns, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 10; // Default: 10 runs for thorough testing
}
