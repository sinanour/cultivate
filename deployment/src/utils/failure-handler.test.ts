/**
 * Unit tests for Failure Handler Module
 */

import { FailureHandler, createFailureHandler } from './failure-handler';
import { FailureDetection, FailureType, FailureDetectionResult } from './failure-detection';
import { DiagnosticCapture, DiagnosticReport } from './diagnostic-capture';
import { RollbackExecutor, RollbackResult } from './rollback-executor';

// Mock dependencies
jest.mock('./logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('FailureHandler', () => {
  let failureDetection: FailureDetection;
  let diagnosticCapture: DiagnosticCapture;
  let rollbackExecutor: RollbackExecutor;
  let failureHandler: FailureHandler;

  beforeEach(() => {
    // Create mock instances
    failureDetection = {
      detectAllFailures: jest.fn(),
      hasAnyFailure: jest.fn(),
      getFailureSummary: jest.fn(),
    } as unknown as FailureDetection;

    diagnosticCapture = {
      captureDiagnostics: jest.fn(),
    } as unknown as DiagnosticCapture;

    rollbackExecutor = {
      executeRollback: jest.fn(),
    } as unknown as RollbackExecutor;

    failureHandler = new FailureHandler(
      failureDetection,
      diagnosticCapture,
      rollbackExecutor
    );
  });

  describe('handleFailure', () => {
    it('should return success when no failures detected', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: false,
          message: 'All healthy',
          timestamp: new Date(),
        },
      ];

      (failureDetection.detectAllFailures as jest.Mock).mockResolvedValue(failures);
      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(false);

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.failures).toEqual(failures);
      expect(diagnosticCapture.captureDiagnostics).not.toHaveBeenCalled();
      expect(rollbackExecutor.executeRollback).not.toHaveBeenCalled();
    });

    it('should capture diagnostics and rollback on failure', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'Container failed',
          timestamp: new Date(),
        },
      ];

      const diagnostics: DiagnosticReport = {
        containers: [],
        compose: { logs: 'test logs', timestamp: new Date() },
        system: {
          dockerStatus: 'running',
          dockerVersion: 'Docker 20.10.0',
          diskUsage: 'test',
          memoryUsage: 'test',
          systemLogs: 'test',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      const rollbackResult: RollbackResult = {
        success: true,
        logs: [],
      };

      (failureDetection.detectAllFailures as jest.Mock).mockResolvedValue(failures);
      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(true);
      (failureDetection.getFailureSummary as jest.Mock).mockReturnValue('Failure summary');
      (diagnosticCapture.captureDiagnostics as jest.Mock).mockResolvedValue(diagnostics);
      (rollbackExecutor.executeRollback as jest.Mock).mockResolvedValue(rollbackResult);

      // Mock verification to succeed
      (failureDetection.detectAllFailures as jest.Mock)
        .mockResolvedValueOnce(failures) // First call for initial detection
        .mockResolvedValueOnce([{ hasFailure: false, message: 'OK', timestamp: new Date() }]); // Second call for verification
      (failureDetection.hasAnyFailure as jest.Mock)
        .mockReturnValueOnce(true) // First call returns true
        .mockReturnValueOnce(false); // Second call returns false

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
        autoRollback: true,
        captureDiagnostics: true,
        verifyRollback: true,
      });

      expect(result.success).toBe(true);
      expect(result.diagnostics).toBeDefined();
      expect(result.rollback).toBeDefined();
      expect(diagnosticCapture.captureDiagnostics).toHaveBeenCalled();
      expect(rollbackExecutor.executeRollback).toHaveBeenCalled();
    });

    it('should skip diagnostics when not requested', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'Container failed',
          timestamp: new Date(),
        },
      ];

      const rollbackResult: RollbackResult = {
        success: true,
        logs: [],
      };

      (failureDetection.detectAllFailures as jest.Mock).mockResolvedValue(failures);
      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(true);
      (failureDetection.getFailureSummary as jest.Mock).mockReturnValue('Failure summary');
      (rollbackExecutor.executeRollback as jest.Mock).mockResolvedValue(rollbackResult);

      // Mock verification
      (failureDetection.detectAllFailures as jest.Mock)
        .mockResolvedValueOnce(failures)
        .mockResolvedValueOnce([{ hasFailure: false, message: 'OK', timestamp: new Date() }]);
      (failureDetection.hasAnyFailure as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
        captureDiagnostics: false,
      });

      expect(result.success).toBe(true);
      expect(result.diagnostics).toBeUndefined();
      expect(diagnosticCapture.captureDiagnostics).not.toHaveBeenCalled();
    });

    it('should skip rollback when not requested', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'Container failed',
          timestamp: new Date(),
        },
      ];

      const diagnostics: DiagnosticReport = {
        containers: [],
        compose: { logs: 'test logs', timestamp: new Date() },
        system: {
          dockerStatus: 'running',
          dockerVersion: 'Docker 20.10.0',
          diskUsage: 'test',
          memoryUsage: 'test',
          systemLogs: 'test',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      (failureDetection.detectAllFailures as jest.Mock).mockResolvedValue(failures);
      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(true);
      (failureDetection.getFailureSummary as jest.Mock).mockReturnValue('Failure summary');
      (diagnosticCapture.captureDiagnostics as jest.Mock).mockResolvedValue(diagnostics);

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
        autoRollback: false,
      });

      expect(result.success).toBe(true);
      expect(result.rollback).toBeUndefined();
      expect(rollbackExecutor.executeRollback).not.toHaveBeenCalled();
    });

    it('should return failure when rollback fails', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'Container failed',
          timestamp: new Date(),
        },
      ];

      const diagnostics: DiagnosticReport = {
        containers: [],
        compose: { logs: 'test logs', timestamp: new Date() },
        system: {
          dockerStatus: 'running',
          dockerVersion: 'Docker 20.10.0',
          diskUsage: 'test',
          memoryUsage: 'test',
          systemLogs: 'test',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      const rollbackResult: RollbackResult = {
        success: false,
        error: 'Rollback failed',
        logs: [],
      };

      (failureDetection.detectAllFailures as jest.Mock).mockResolvedValue(failures);
      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(true);
      (failureDetection.getFailureSummary as jest.Mock).mockReturnValue('Failure summary');
      (diagnosticCapture.captureDiagnostics as jest.Mock).mockResolvedValue(diagnostics);
      (rollbackExecutor.executeRollback as jest.Mock).mockResolvedValue(rollbackResult);

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rollback failed');
    });

    it('should return failure when rollback verification fails', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: true,
          failureType: FailureType.CONTAINER_STARTUP,
          message: 'Container failed',
          timestamp: new Date(),
        },
      ];

      const diagnostics: DiagnosticReport = {
        containers: [],
        compose: { logs: 'test logs', timestamp: new Date() },
        system: {
          dockerStatus: 'running',
          dockerVersion: 'Docker 20.10.0',
          diskUsage: 'test',
          memoryUsage: 'test',
          systemLogs: 'test',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      const rollbackResult: RollbackResult = {
        success: true,
        logs: [],
      };

      (failureDetection.detectAllFailures as jest.Mock)
        .mockResolvedValueOnce(failures) // Initial detection
        .mockResolvedValueOnce(failures); // Verification still shows failures

      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(true);
      (failureDetection.getFailureSummary as jest.Mock).mockReturnValue('Failure summary');
      (diagnosticCapture.captureDiagnostics as jest.Mock).mockResolvedValue(diagnostics);
      (rollbackExecutor.executeRollback as jest.Mock).mockResolvedValue(rollbackResult);

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
        verifyRollback: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rollback verification failed');
    });

    it('should handle errors during failure handling', async () => {
      (failureDetection.detectAllFailures as jest.Mock).mockRejectedValue(
        new Error('Detection failed')
      );

      const result = await failureHandler.handleFailure({
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Detection failed');
    });
  });

  describe('handleDetectedFailure', () => {
    it('should handle pre-detected failures', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: true,
          failureType: FailureType.HEALTH_CHECK,
          message: 'Health check failed',
          timestamp: new Date(),
        },
      ];

      const diagnostics: DiagnosticReport = {
        containers: [],
        compose: { logs: 'test logs', timestamp: new Date() },
        system: {
          dockerStatus: 'running',
          dockerVersion: 'Docker 20.10.0',
          diskUsage: 'test',
          memoryUsage: 'test',
          systemLogs: 'test',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      const rollbackResult: RollbackResult = {
        success: true,
        logs: [],
      };

      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(true);
      (failureDetection.getFailureSummary as jest.Mock).mockReturnValue('Failure summary');
      (diagnosticCapture.captureDiagnostics as jest.Mock).mockResolvedValue(diagnostics);
      (rollbackExecutor.executeRollback as jest.Mock).mockResolvedValue(rollbackResult);

      // Mock verification
      (failureDetection.detectAllFailures as jest.Mock).mockResolvedValue([
        { hasFailure: false, message: 'OK', timestamp: new Date() },
      ]);
      (failureDetection.hasAnyFailure as jest.Mock)
        .mockReturnValueOnce(true) // First call for initial check
        .mockReturnValueOnce(false); // Second call for verification

      const result = await failureHandler.handleDetectedFailure(failures, {
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
      });

      expect(result.success).toBe(true);
      expect(result.failures).toEqual(failures);
      expect(rollbackExecutor.executeRollback).toHaveBeenCalled();
    });

    it('should return success when no failures to handle', async () => {
      const failures: FailureDetectionResult[] = [
        {
          hasFailure: false,
          message: 'All healthy',
          timestamp: new Date(),
        },
      ];

      (failureDetection.hasAnyFailure as jest.Mock).mockReturnValue(false);

      const result = await failureHandler.handleDetectedFailure(failures, {
        workingDirectory: '/opt/test',
        rollbackOptions: {
          targetHost: 'test.example.com',
          sshConfig: { username: 'test' },
        },
      });

      expect(result.success).toBe(true);
      expect(rollbackExecutor.executeRollback).not.toHaveBeenCalled();
    });
  });

  describe('createFailureHandler', () => {
    it('should create a failure handler instance', () => {
      const instance = createFailureHandler(
        failureDetection,
        diagnosticCapture,
        rollbackExecutor
      );

      expect(instance).toBeInstanceOf(FailureHandler);
    });
  });
});
