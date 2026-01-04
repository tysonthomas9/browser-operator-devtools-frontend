/**
 * JSON Reporter - Outputs results as JSON file
 */

import fs from 'fs';
import type { RunSummary } from '../types.ts';

export class JsonReporter {
  private outputPath?: string;

  constructor(outputPath?: string) {
    this.outputPath = outputPath;
  }

  async generate(summary: RunSummary): Promise<void> {
    const output = {
      experiment: summary.experiment,
      timestamp: summary.startTime.toISOString(),
      duration: summary.duration,
      summary: {
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        errors: summary.errors,
        skipped: summary.skipped,
        passRate: summary.total > 0 ? summary.passed / summary.total : 0,
        averageScore: summary.averageScore,
        averageDuration: summary.averageDuration,
      },
      results: summary.results.map(r => ({
        testId: r.testId,
        testName: r.testName,
        status: r.status,
        score: r.score,
        duration: r.duration,
        error: r.error,
        validation: r.validation,
        screenshots: r.screenshots,
        metadata: r.metadata,
      })),
    };

    const jsonString = JSON.stringify(output, null, 2);

    if (this.outputPath) {
      fs.writeFileSync(this.outputPath, jsonString);
      console.log(`\n📄 JSON report written to: ${this.outputPath}`);
    } else {
      console.log('\n' + jsonString);
    }
  }
}
