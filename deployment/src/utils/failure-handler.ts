/**
 * Failure Handler Module
 * 
 * Implements automatic rollback on deployment failures:
 * - Triggers rollback when deployment fails
 * - Displays diagnostic information before rollback
 * - Verifies rollback success
 * 
 * Requirements: 10.5, 14.1
 */

import { FailureDetection, FailureDetectionResult } from './failure-detection.js';
import { DiagnosticCapture, DiagnosticReport } from './diagnostic-capture.js';
import { RollbackExecutor, RollbackOptions, RollbackResult } from './rollback-executor.js';
import { createLogger } from './logger.js';

const logger = createLogger();

/**
 * Failure handling options
 */
export interface FailureHandlingOptions {
  /** Working directory containing docker-compose.yml */
  workingDirectory: string;

  /** Rollback options */
  rollbackOptions: RollbackOptions;

  /** Whether to automatically rollback on failure */
  autoRollback?: boolean;

  /** Whether to capture diagnostics before rollback */
  captureDiagnostics?: boolean;

  /** Whether to verify rollback success */
  verifyRollback?: boolean;
}

/**
 * Failure handling result
 */
export interface FailureHandlingResult {
  /** Whether failure was handled successfully */
  success: boolean;

  /** Detected failures */
  failures: FailureDetectionResult[];

  /** Diagnostic report (if captured) */
  diagnostics?: DiagnosticReport;

  /** Rollback result (if rollback was performed) */
  rollback?: RollbackResult;

  /** Error message if handling failed */
  error?: string;

  /** Timestamp when handling was performed */
  timestamp: Date;
}

/**
 * Failure Handler
 * Handles deployment failures with automatic rollback and diagnostics
 */
export class FailureHandler {
  private failureDetection: FailureDetection;
  private diagnosticCapture: DiagnosticCapture;
  private rollbackExecutor: RollbackExecutor;

  constructor(
    failureDetection: FailureDetection,
    diagnosticCapture: DiagnosticCapture,
    rollbackExecutor: RollbackExecutor
  ) {
    this.failureDetection = failureDetection;
    this.diagnosticCapture = diagnosticCapture;
    this.rollbackExecutor = rollbackExecutor;
  }

  /**
   * Handle deployment failure
   * 
   * @param options - Failure handling options
   * @returns Failure handling result
   */
  async handleFailure(
    options: FailureHandlingOptions
  ): Promise<FailureHandlingResult> {
    const timestamp = new Date();
    logger.info('Handling deployment failure...');

    try {
      // Detect failures
      logger.info('Detecting failures...');
      const failures = await this.failureDetection.detectAllFailures({
        workingDirectory: options.workingDirectory,
        checkSSH: true,
        checkContainers: true,
        checkHealth: true,
      });

      // Check if any failures were detected
      const hasFailures = this.failureDetection.hasAnyFailure(failures);

      if (!hasFailures) {
        logger.info('No failures detected');
        return {
          success: true,
          failures,
          timestamp,
        };
      }

      // Log failure summary
      const failureSummary = this.failureDetection.getFailureSummary(failures);
      logger.error(`Failures detected:\n${failureSummary}`);

      // Capture diagnostics if requested
      let diagnostics: DiagnosticReport | undefined;
      if (options.captureDiagnostics !== false) {
        logger.info('Capturing diagnostic information...');
        diagnostics = await this.diagnosticCapture.captureDiagnostics({
          workingDirectory: options.workingDirectory,
          logLines: 100,
          captureSystemLogs: true,
          captureComposeConfig: true,
        });

        // Display diagnostic summary
        this.displayDiagnosticSummary(diagnostics);
      }

      // Perform rollback if requested
      let rollback: RollbackResult | undefined;
      if (options.autoRollback !== false) {
        logger.info('Initiating automatic rollback...');
        rollback = await this.rollbackExecutor.executeRollback(
          options.rollbackOptions
        );

        if (!rollback.success) {
          logger.error(`Rollback failed: ${rollback.error}`);
          return {
            success: false,
            failures,
            diagnostics,
            rollback,
            error: `Rollback failed: ${rollback.error}`,
            timestamp,
          };
        }

        logger.info('Rollback completed successfully');

        // Verify rollback if requested
        if (options.verifyRollback !== false) {
          logger.info('Verifying rollback...');
          const verificationResult = await this.verifyRollbackSuccess(
            options.workingDirectory
          );

          if (!verificationResult.success) {
            logger.error(`Rollback verification failed: ${verificationResult.message}`);
            return {
              success: false,
              failures,
              diagnostics,
              rollback,
              error: `Rollback verification failed: ${verificationResult.message}`,
              timestamp,
            };
          }

          logger.info('Rollback verification passed');
        }
      }

      return {
        success: true,
        failures,
        diagnostics,
        rollback,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failure handling error: ${errorMessage}`);

      return {
        success: false,
        failures: [],
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Display diagnostic summary
   * 
   * @param diagnostics - Diagnostic report
   */
  private displayDiagnosticSummary(diagnostics: DiagnosticReport): void {
    logger.info('='.repeat(80));
    logger.info('DIAGNOSTIC SUMMARY');
    logger.info('='.repeat(80));

    // Container summary
    logger.info(`\nContainers: ${diagnostics.containers.length}`);
    for (const container of diagnostics.containers) {
      logger.info(`  - ${container.containerName}: ${container.state} (${container.health})`);
    }

    // System summary
    logger.info(`\nDocker Version: ${diagnostics.system.dockerVersion}`);
    logger.info(`Disk Usage: ${diagnostics.system.diskUsage.split('\n')[1] || 'N/A'}`);
    logger.info(`Memory Usage: ${diagnostics.system.memoryUsage.split('\n')[1] || 'N/A'}`);

    logger.info('='.repeat(80));
  }

  /**
   * Verify rollback success
   * 
   * @param workingDirectory - Working directory containing docker-compose.yml
   * @returns Verification result
   */
  private async verifyRollbackSuccess(
    workingDirectory: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check for failures after rollback
      const failures = await this.failureDetection.detectAllFailures({
        workingDirectory,
        checkSSH: true,
        checkContainers: true,
        checkHealth: true,
      });

      const hasFailures = this.failureDetection.hasAnyFailure(failures);

      if (hasFailures) {
        const failureSummary = this.failureDetection.getFailureSummary(failures);
        return {
          success: false,
          message: `Failures still present after rollback:\n${failureSummary}`,
        };
      }

      return {
        success: true,
        message: 'Rollback verification passed - no failures detected',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Rollback verification error: ${errorMessage}`,
      };
    }
  }

  /**
   * Handle failure with custom failure detection results
   * 
   * @param failures - Pre-detected failures
   * @param options - Failure handling options
   * @returns Failure handling result
   */
  async handleDetectedFailure(
    failures: FailureDetectionResult[],
    options: FailureHandlingOptions
  ): Promise<FailureHandlingResult> {
    const timestamp = new Date();
    logger.info('Handling detected failure...');

    try {
      // Check if any failures were detected
      const hasFailures = this.failureDetection.hasAnyFailure(failures);

      if (!hasFailures) {
        logger.info('No failures to handle');
        return {
          success: true,
          failures,
          timestamp,
        };
      }

      // Log failure summary
      const failureSummary = this.failureDetection.getFailureSummary(failures);
      logger.error(`Handling failures:\n${failureSummary}`);

      // Capture diagnostics if requested
      let diagnostics: DiagnosticReport | undefined;
      if (options.captureDiagnostics !== false) {
        logger.info('Capturing diagnostic information...');
        diagnostics = await this.diagnosticCapture.captureDiagnostics({
          workingDirectory: options.workingDirectory,
          logLines: 100,
          captureSystemLogs: true,
          captureComposeConfig: true,
        });

        // Display diagnostic summary
        this.displayDiagnosticSummary(diagnostics);
      }

      // Perform rollback if requested
      let rollback: RollbackResult | undefined;
      if (options.autoRollback !== false) {
        logger.info('Initiating automatic rollback...');
        rollback = await this.rollbackExecutor.executeRollback(
          options.rollbackOptions
        );

        if (!rollback.success) {
          logger.error(`Rollback failed: ${rollback.error}`);
          return {
            success: false,
            failures,
            diagnostics,
            rollback,
            error: `Rollback failed: ${rollback.error}`,
            timestamp,
          };
        }

        logger.info('Rollback completed successfully');

        // Verify rollback if requested
        if (options.verifyRollback !== false) {
          logger.info('Verifying rollback...');
          const verificationResult = await this.verifyRollbackSuccess(
            options.workingDirectory
          );

          if (!verificationResult.success) {
            logger.error(`Rollback verification failed: ${verificationResult.message}`);
            return {
              success: false,
              failures,
              diagnostics,
              rollback,
              error: `Rollback verification failed: ${verificationResult.message}`,
              timestamp,
            };
          }

          logger.info('Rollback verification passed');
        }
      }

      return {
        success: true,
        failures,
        diagnostics,
        rollback,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failure handling error: ${errorMessage}`);

      return {
        success: false,
        failures,
        error: errorMessage,
        timestamp,
      };
    }
  }
}

/**
 * Create a failure handler instance
 * 
 * @param failureDetection - Failure detection instance
 * @param diagnosticCapture - Diagnostic capture instance
 * @param rollbackExecutor - Rollback executor instance
 * @returns Failure handler instance
 */
export function createFailureHandler(
  failureDetection: FailureDetection,
  diagnosticCapture: DiagnosticCapture,
  rollbackExecutor: RollbackExecutor
): FailureHandler {
  return new FailureHandler(failureDetection, diagnosticCapture, rollbackExecutor);
}
