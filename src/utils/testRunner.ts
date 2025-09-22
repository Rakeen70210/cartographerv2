/**
 * Comprehensive Test Runner
 * Runs all integration tests, performance tests, and edge case tests
 */

import { testRunner } from '../__tests__/e2e/testRunner';
import { runEdgeCaseTests } from './edgeCaseTesting';
import { quickPerformanceOptimization } from './performanceOptimization';

export interface TestRunnerResult {
  success: boolean;
  totalDuration: number;
  results: {
    integration: any;
    edgeCases: any;
    performance: any;
  };
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    testSuites: number;
  };
}

/**
 * Run all comprehensive tests
 */
export async function runAllTests(): Promise<TestRunnerResult> {
  console.log('🚀 Starting Comprehensive Test Suite...');
  const overallStartTime = Date.now();

  let integrationResults: any = null;
  let edgeCaseResults: any = null;
  let performanceResults: any = null;

  try {
    // 1. Run integration tests
    console.log('\n📋 Running Integration Tests...');
    integrationResults = await testRunner.runAllTests();
    
    // 2. Run edge case tests
    console.log('\n🧪 Running Edge Case Tests...');
    try {
      await runEdgeCaseTests();
      edgeCaseResults = { success: true, message: 'All edge case tests passed' };
    } catch (error) {
      edgeCaseResults = { 
        success: false, 
        message: error instanceof Error ? error.message : 'Edge case tests failed' 
      };
    }
    
    // 3. Run performance optimization
    console.log('\n⚡ Running Performance Tests...');
    performanceResults = await quickPerformanceOptimization();
    
    const overallEndTime = Date.now();
    const totalDuration = overallEndTime - overallStartTime;
    
    // Calculate summary
    const summary = {
      totalTests: integrationResults.results.reduce((sum: number, suite: any) => sum + suite.totalTests, 0),
      passedTests: integrationResults.results.reduce((sum: number, suite: any) => sum + suite.passedTests, 0),
      failedTests: integrationResults.results.reduce((sum: number, suite: any) => sum + suite.failedTests, 0),
      testSuites: integrationResults.results.length
    };
    
    const overallSuccess = integrationResults.success && 
                          edgeCaseResults.success && 
                          performanceResults.applied.length > 0;
    
    const result: TestRunnerResult = {
      success: overallSuccess,
      totalDuration,
      results: {
        integration: integrationResults,
        edgeCases: edgeCaseResults,
        performance: performanceResults
      },
      summary
    };
    
    // Print final summary
    printTestSummary(result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    
    const overallEndTime = Date.now();
    const totalDuration = overallEndTime - overallStartTime;
    
    return {
      success: false,
      totalDuration,
      results: {
        integration: integrationResults,
        edgeCases: edgeCaseResults,
        performance: performanceResults
      },
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        testSuites: 0
      }
    };
  }
}

/**
 * Print comprehensive test summary
 */
function printTestSummary(result: TestRunnerResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`Overall Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
  console.log(`Test Suites: ${result.summary.testSuites}`);
  console.log(`Total Tests: ${result.summary.totalTests}`);
  console.log(`Passed: ${result.summary.passedTests}`);
  console.log(`Failed: ${result.summary.failedTests}`);
  
  console.log('\n📋 Integration Tests:');
  if (result.results.integration) {
    console.log(`  Status: ${result.results.integration.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Suites: ${result.results.integration.totalSuites}`);
    console.log(`  Duration: ${(result.results.integration.totalDuration / 1000).toFixed(2)}s`);
  } else {
    console.log('  Status: ❌ NOT RUN');
  }
  
  console.log('\n🧪 Edge Case Tests:');
  if (result.results.edgeCases) {
    console.log(`  Status: ${result.results.edgeCases.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Message: ${result.results.edgeCases.message}`);
  } else {
    console.log('  Status: ❌ NOT RUN');
  }
  
  console.log('\n⚡ Performance Tests:');
  if (result.results.performance) {
    console.log(`  Status: ✅ COMPLETED`);
    console.log(`  Optimizations Applied: ${result.results.performance.applied.length}`);
    console.log(`  Memory Freed: ${result.results.performance.memoryFreed.toFixed(1)}MB`);
    console.log(`  Performance Improvement: ${result.results.performance.performanceImprovement.toFixed(1)}%`);
  } else {
    console.log('  Status: ❌ NOT RUN');
  }
  
  if (result.results.integration && result.results.integration.results) {
    console.log('\n📝 Detailed Results:');
    result.results.integration.results.forEach((suite: any) => {
      const status = suite.failedTests === 0 ? '✅' : '❌';
      console.log(`  ${status} ${suite.suiteName}: ${suite.passedTests}/${suite.totalTests} (${(suite.duration / 1000).toFixed(2)}s)`);
    });
  }
  
  if (!result.success) {
    console.log('\n⚠️  Some tests failed. Check the detailed logs above for more information.');
  }
  
  console.log('='.repeat(80));
}

/**
 * Run tests with specific configuration
 */
export async function runTestsWithConfig(config: {
  includeIntegration: boolean;
  includeEdgeCases: boolean;
  includePerformance: boolean;
}): Promise<TestRunnerResult> {
  console.log('🚀 Starting Configured Test Suite...');
  const overallStartTime = Date.now();

  let integrationResults: any = null;
  let edgeCaseResults: any = null;
  let performanceResults: any = null;

  try {
    if (config.includeIntegration) {
      console.log('\n📋 Running Integration Tests...');
      integrationResults = await testRunner.runAllTests();
    }
    
    if (config.includeEdgeCases) {
      console.log('\n🧪 Running Edge Case Tests...');
      try {
        await runEdgeCaseTests();
        edgeCaseResults = { success: true, message: 'All edge case tests passed' };
      } catch (error) {
        edgeCaseResults = { 
          success: false, 
          message: error instanceof Error ? error.message : 'Edge case tests failed' 
        };
      }
    }
    
    if (config.includePerformance) {
      console.log('\n⚡ Running Performance Tests...');
      performanceResults = await quickPerformanceOptimization();
    }
    
    const overallEndTime = Date.now();
    const totalDuration = overallEndTime - overallStartTime;
    
    const summary = {
      totalTests: integrationResults ? integrationResults.results.reduce((sum: number, suite: any) => sum + suite.totalTests, 0) : 0,
      passedTests: integrationResults ? integrationResults.results.reduce((sum: number, suite: any) => sum + suite.passedTests, 0) : 0,
      failedTests: integrationResults ? integrationResults.results.reduce((sum: number, suite: any) => sum + suite.failedTests, 0) : 0,
      testSuites: integrationResults ? integrationResults.results.length : 0
    };
    
    const overallSuccess = (!config.includeIntegration || (integrationResults && integrationResults.success)) &&
                          (!config.includeEdgeCases || (edgeCaseResults && edgeCaseResults.success)) &&
                          (!config.includePerformance || (performanceResults && performanceResults.applied.length > 0));
    
    const result: TestRunnerResult = {
      success: overallSuccess,
      totalDuration,
      results: {
        integration: integrationResults,
        edgeCases: edgeCaseResults,
        performance: performanceResults
      },
      summary
    };
    
    printTestSummary(result);
    return result;
    
  } catch (error) {
    console.error('❌ Configured test suite failed:', error);
    
    const overallEndTime = Date.now();
    const totalDuration = overallEndTime - overallStartTime;
    
    return {
      success: false,
      totalDuration,
      results: {
        integration: integrationResults,
        edgeCases: edgeCaseResults,
        performance: performanceResults
      },
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        testSuites: 0
      }
    };
  }
}

/**
 * Quick test run for development
 */
export async function runQuickTests(): Promise<TestRunnerResult> {
  return runTestsWithConfig({
    includeIntegration: true,
    includeEdgeCases: false,
    includePerformance: true
  });
}

/**
 * Full test run for CI/CD
 */
export async function runFullTests(): Promise<TestRunnerResult> {
  return runTestsWithConfig({
    includeIntegration: true,
    includeEdgeCases: true,
    includePerformance: true
  });
}