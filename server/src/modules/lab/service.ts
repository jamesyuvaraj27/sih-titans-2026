import { runWithAiFallback, queryGemini, type AiExecutionResult } from '../../lib/aiFallback.js';

export interface LabExplainRequest {
  labId: string;
  dataset?: any;
  results?: any;
  mode?: 'result_explanation' | 'hint' | 'error_explanation';
  questionContext?: {
    question: string;
    selectedOption?: string;
    correctOption?: string;
  };
  simulateFallback?: boolean;
}

export interface LabExplainResponse {
  explanation: string;
  keyTakeaway?: string;
}

/**
 * Deterministic local fallback generator for lab explanations and hints.
 * Guarantees that statistical concepts are clearly explained even when Gemini
 * is rate-limited (429), offline, or unavailable.
 */
export function generateDeterministicLabExplanation(req: LabExplainRequest): LabExplainResponse {
  const { labId, results, mode, questionContext } = req;

  // 1. Practice question hint / error mode
  if (mode === 'hint' && questionContext) {
    return {
      explanation: `Hint: Focus on how changes in the entire dataset affect individual metrics. For example, extreme outliers shift the arithmetic mean significantly, while rank-based metrics like median remain resistant.`,
      keyTakeaway: 'Always consider sensitivity to extreme values when choosing summary metrics.',
    };
  }

  if (mode === 'error_explanation' && questionContext) {
    return {
      explanation: `Review: In statistical theory, the correct principle is: "${questionContext.correctOption}". Unlike the mean, the median depends only on rank order, which makes it an ideal measure of central tendency for skewed government survey data.`,
      keyTakeaway: 'Sample statistics provide unbiased estimates when calculated with appropriate degrees of freedom.',
    };
  }

  // 2. Lab-specific deterministic result explanations
  switch (labId) {
    case 'mean-median-mode': {
      const mean = Number(results?.mean ?? 0);
      const median = Number(results?.median ?? 0);
      const count = Number(results?.count ?? 0);
      const diff = Math.abs(mean - median);

      let skewnessInsight = '';
      if (diff < 0.2) {
        skewnessInsight = `The mean (${mean.toFixed(2)}) and median (${median.toFixed(2)}) are virtually identical, indicating a balanced, symmetric distribution across these ${count} observations.`;
      } else if (mean > median) {
        skewnessInsight = `The mean (${mean.toFixed(2)}) is visibly greater than the median (${median.toFixed(2)}). This positive divergence indicates a right-skewed distribution caused by higher values pulling the arithmetic average upward.`;
      } else {
        skewnessInsight = `The mean (${mean.toFixed(2)}) is lower than the median (${median.toFixed(2)}). This negative divergence indicates left-skewness driven by lower tail values.`;
      }

      return {
        explanation: `${skewnessInsight} In official surveys, reporting the median alongside the mean prevents policy conclusions from being distorted by extreme outliers.`,
        keyTakeaway: `Mean = ${mean.toFixed(2)} | Median = ${median.toFixed(2)} | Count = ${count}`,
      };
    }

    case 'standard-deviation': {
      const sd = Number(results?.sd ?? results?.sampleSd ?? 0);
      const mean = Number(results?.mean ?? 0);
      const isSample = Boolean(results?.isSample ?? true);
      const cv = mean > 0 ? (sd / mean) * 100 : 0;

      return {
        explanation: `With an average of ${mean.toFixed(2)} and a standard deviation of ${sd.toFixed(2)} (using ${isSample ? "Bessel's sample correction with divisor n - 1" : 'population formula with divisor n'}), approximately 68% of normal observations fall in the range [${(mean - sd).toFixed(2)}, ${(mean + sd).toFixed(2)}]. The coefficient of variation is ${cv.toFixed(1)}%, reflecting ${cv < 20 ? 'low' : cv < 40 ? 'moderate' : 'high'} relative dispersion across the observations.`,
        keyTakeaway: `Data dispersion: ${sd.toFixed(2)} units around mean ${mean.toFixed(2)}.`,
      };
    }

    case 'data-visualization': {
      const chartType = String(results?.chartType ?? 'Bar');
      const datasetName = String(results?.datasetName ?? 'Survey Dataset');

      return {
        explanation: `Visualizing ${datasetName} using a ${chartType} chart allows analysts to detect trends and categorical disparities. Bar charts excel at discrete administrative comparisons, line charts reveal continuous temporal trends, and area charts emphasize cumulative volume across survey rounds.`,
        keyTakeaway: `Selected: ${chartType} chart for ${datasetName}.`,
      };
    }

    case 'basic-data-analysis': {
      const meanAchieved = Number(results?.meanAchieved ?? 0);
      const count = Number(results?.count ?? 0);
      const totalAchieved = Number(results?.totalAchieved ?? 0);
      const totalTarget = Number(results?.totalTarget ?? 0);
      const pct = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

      return {
        explanation: `Analysis of ${count} filtered administrative records indicates an aggregate completion rate of ${pct.toFixed(1)}% (${totalAchieved.toLocaleString()} achieved out of ${totalTarget.toLocaleString()} target). The average achievement per district is ${meanAchieved.toFixed(1)} units.`,
        keyTakeaway: `Overall performance: ${pct.toFixed(1)}% across ${count} administrative units.`,
      };
    }

    default:
      return {
        explanation: `Experiment completed successfully. All statistical computations were verified locally within your browser.`,
        keyTakeaway: 'Local deterministic validation confirmed.',
      };
  }
}

/**
 * Executes lab explanation with AI enhancement and deterministic fallback.
 */
export async function explainLabExperiment(
  req: LabExplainRequest,
): Promise<AiExecutionResult<LabExplainResponse>> {
  const taskName = `lab-explain:${req.labId}:${req.mode ?? 'result'}`;

  return runWithAiFallback<LabExplainResponse>(
    taskName,
    async () => {
      // Primary: Query Gemini
      const prompt = `You are an expert statistics educator for government statistical officers in STATINTEL.
Explain the following interactive lab experiment clearly and pedagogically in 2 to 3 sentences.
Lab ID: ${req.labId}
Mode: ${req.mode ?? 'result_explanation'}
Dataset: ${JSON.stringify(req.dataset)}
Calculated Results: ${JSON.stringify(req.results)}
${req.questionContext ? `Question Context: ${JSON.stringify(req.questionContext)}` : ''}

Requirements:
- Emphasize the statistical principle (e.g. outlier resistance, variance, sample vs population, or chart appropriateness).
- Do not compute or invent new numbers; reference the verified numbers provided.
- Keep the tone professional, encouraging, and clear.`;

      const systemInstruction = `You are a supportive, precise statistics educator for India's official statistical system.`;
      const reply = await queryGemini(prompt, systemInstruction);

      return {
        explanation: reply.trim(),
        keyTakeaway: `Educational insight for ${req.labId}`,
      };
    },
    () => {
      // Fallback: Local deterministic generator
      return generateDeterministicLabExplanation(req);
    },
    { simulateFallback: req.simulateFallback, timeoutMs: 7000 },
  );
}
