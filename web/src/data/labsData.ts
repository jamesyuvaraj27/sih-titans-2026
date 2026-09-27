export interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LabMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  learningObjective: string;
  category: 'Descriptive Statistics' | 'Dispersion & Variation' | 'Visual Analytics' | 'Exploratory Analysis';
  difficulty: 'Beginner' | 'Intermediate';
  estimatedMinutes: number;
  competencyCode: string;
  practiceQuestions: PracticeQuestion[];
}

export const LABS: LabMeta[] = [
  // ── Lab 1: Mean, Median & Mode ──────────────────────────────────────────
  {
    id: 'mean-median-mode',
    title: 'Mean, Median & Mode Lab',
    subtitle: 'Measures of Central Tendency & Outlier Sensitivity',
    description: 'Explore how distributions behave and see firsthand why the mean is distorted by extreme values while the median stays robust.',
    learningObjective: 'Calculate and compare mean, median, and mode on custom datasets; identify distribution skewness; and select the appropriate metric for skewed data.',
    category: 'Descriptive Statistics',
    difficulty: 'Beginner',
    estimatedMinutes: 10,
    competencyCode: 'STAT.FOUND.DESC',
    practiceQuestions: [
      {
        id: 'mmm-q1',
        question: 'If a billionaire moves into a small town of 100 middle-income families, which measure of central tendency will increase the most?',
        options: [
          'The median income',
          'The mode income',
          'The mean income',
          'All three will increase by the exact same amount'
        ],
        correctIndex: 2,
        explanation: 'Correct! The mean is sensitive to extreme values (outliers) because it sums every data point. The median simply takes the 50th percentile rank, which shifts by at most one position.'
      },
      {
        id: 'mmm-q2',
        question: 'When a distribution is right-skewed (positively skewed), what is the typical relationship between the mean and median?',
        options: [
          'Mean < Median',
          'Mean > Median',
          'Mean = Median',
          'Mode is always higher than both'
        ],
        correctIndex: 1,
        explanation: 'Correct! In a right-skewed distribution (such as income or wealth), the long tail of high values pulls the arithmetic mean to the right of the median.'
      },
      {
        id: 'mmm-q3',
        question: 'Which measure of central tendency is the only one suitable for nominal categorical data (e.g. favorite primary language)?',
        options: [
          'Mean',
          'Median',
          'Mode',
          'Standard Deviation'
        ],
        correctIndex: 2,
        explanation: 'Correct! Nominal categorical data cannot be added or ranked, so you cannot compute a mean or median; the mode identifies the most frequent category.'
      }
    ]
  },

  // ── Lab 2: Standard Deviation ───────────────────────────────────────────
  {
    id: 'standard-deviation',
    title: 'Standard Deviation Lab',
    subtitle: 'Quantifying Spread, Variance & Distance from the Mean',
    description: 'Calculate variance and standard deviation step-by-step. Discover how spreading out numbers changes variability and compare sample vs. population calculations.',
    learningObjective: 'Compute deviations, sum of squares, variance, and standard deviation; understand Bessel’s correction (n - 1); and interpret the spread of statistical data.',
    category: 'Dispersion & Variation',
    difficulty: 'Beginner',
    estimatedMinutes: 12,
    competencyCode: 'STAT.FOUND.DESC',
    practiceQuestions: [
      {
        id: 'sd-q1',
        question: 'What happens to the standard deviation when the data values become more spread out from the mean?',
        options: [
          'The standard deviation decreases toward zero',
          'The standard deviation increases',
          'The standard deviation remains completely unchanged',
          'The standard deviation becomes negative'
        ],
        correctIndex: 1,
        explanation: 'Correct! Standard deviation measures the typical distance of data points from their mean. Greater dispersion increases the squared deviations, yielding a higher standard deviation.'
      },
      {
        id: 'sd-q2',
        question: 'Why do we divide by (n - 1) instead of n when calculating sample standard deviation?',
        options: [
          'To make the calculation simpler for human mathematicians',
          'Because one data point is always discarded as an outlier',
          'Bessel’s correction: to correct for negative bias and provide an unbiased estimate of the population variance',
          'Because the last data point has zero weight'
        ],
        correctIndex: 2,
        explanation: 'Correct! Dividing by (n - 1) (Bessel’s correction) compensates for the fact that sample spread underestimates the true population spread around the unknown true population mean.'
      },
      {
        id: 'sd-q3',
        question: 'If every single student in an exam scores exactly 75 marks, what is the standard deviation of the scores?',
        options: [
          '75',
          '1',
          '0',
          'Undefined'
        ],
        correctIndex: 2,
        explanation: 'Correct! When all data points are identical, every point equals the mean, so every deviation (x - μ) is 0, resulting in a standard deviation of 0 (no dispersion).'
      }
    ]
  },

  // ── Lab 3: Data Visualization ──────────────────────────────────────────
  {
    id: 'data-visualization',
    title: 'Data Visualization Lab',
    subtitle: 'Selecting Appropriate Chart Types & Visual Insights',
    description: 'Experiment with different chart types on real statistical datasets. Learn when to use bar charts, line trends, or area plots to convey findings without distortion.',
    learningObjective: 'Choose optimal visual encodings for categorical vs. time-series data, format axes properly, and interpret trends and anomalies visually.',
    category: 'Visual Analytics',
    difficulty: 'Intermediate',
    estimatedMinutes: 15,
    competencyCode: 'TECH.SPREAD',
    practiceQuestions: [
      {
        id: 'dv-q1',
        question: 'Which chart type is best suited for showing how India’s Consumer Price Index (CPI) has changed month-over-month over the last 12 months?',
        options: [
          'Pie Chart',
          'Line Chart',
          'Radar Chart',
          'Treemap'
        ],
        correctIndex: 1,
        explanation: 'Correct! Line charts are the gold standard for continuous time-series data because the connecting lines emphasize velocity, momentum, and direction of temporal trends.'
      },
      {
        id: 'dv-q2',
        question: 'Why should a bar chart comparing survey completion totals between 5 states almost always start with a zero-baseline on the value axis?',
        options: [
          'To save ink and screen pixels',
          'Because non-zero baselines truncate bars, exaggerating modest differences into misleading visual disparities',
          'Because statistical software crashes with negative numbers',
          'It is only a convention and has no effect on human perception'
        ],
        correctIndex: 1,
        explanation: 'Correct! Human visual perception judges bar charts by the physical length of the bar. Truncating the axis distorts the proportional comparison.'
      },
      {
        id: 'dv-q3',
        question: 'When would an Area Chart be preferred over a simple Line Chart?',
        options: [
          'When plotting independent non-ordered categories like state names',
          'When visualizing cumulative magnitude or showing how parts contribute to a whole total over time',
          'When you have more than 25 overlapping series',
          'When data contains negative values that should be hidden'
        ],
        correctIndex: 1,
        explanation: 'Correct! Area charts excel at displaying cumulative volume or part-to-whole relationships over time, reinforcing the visual sense of volume beneath the curve.'
      }
    ]
  },

  // ── Lab 4: Basic Data Analysis ──────────────────────────────────────────
  {
    id: 'basic-data-analysis',
    title: 'Basic Data Analysis Lab',
    subtitle: 'Data Filtering, Aggregations & Subgroup Comparisons',
    description: 'Work with a realistic district survey returns dataset. Filter by administrative cadre, compute aggregate metrics, and compare subgroup performance.',
    learningObjective: 'Perform exploratory data analysis (EDA), calculate subgroup summaries (mean, min, max, count), and interpret operational data quality indicators.',
    category: 'Exploratory Analysis',
    difficulty: 'Intermediate',
    estimatedMinutes: 15,
    competencyCode: 'TECH.PY.DATA',
    practiceQuestions: [
      {
        id: 'bda-q1',
        question: 'In a survey monitoring dataset, if the response rate is 96% but the data quality audit score is only 42%, what does this indicate?',
        options: [
          'The survey was an absolute success with no issues',
          'High compliance in quantity, but severe potential issues in enumeration accuracy, missing fields, or hasty data entry',
          'The sample size was too large',
          'The survey schedule should be published immediately'
        ],
        correctIndex: 1,
        explanation: 'Correct! High response rate simply means households were contacted; low quality scores signal that the recorded data may have validation contradictions, omissions, or scrutiny errors.'
      },
      {
        id: 'bda-q2',
        question: 'What is the main benefit of calculating summary statistics by subgroup (e.g. grouping by Cadre or District) rather than just looking at the overall national average?',
        options: [
          'It makes the final report much longer',
          'It reveals Simpson’s paradox or localized pockets of underperformance that are masked by a broad overall aggregate',
          'Subgroups always have zero standard deviation',
          'It eliminates the need for data cleaning'
        ],
        correctIndex: 1,
        explanation: 'Correct! Aggregate averages can mask critical disparities. Disaggregating by district or cadre pinpoints exactly where operational interventions or retraining are required.'
      },
      {
        id: 'bda-q3',
        question: 'Before calculating the average household consumption from raw survey records, what is the most critical first data-cleaning step?',
        options: [
          'Convert all numbers to Roman numerals',
          'Sort alphabetically by district',
          'Check for missing/null values, negative expenditures, and duplicate household IDs',
          'Multiply all values by 100'
        ],
        correctIndex: 2,
        explanation: 'Correct! Data scrutiny and validation (handling nulls, duplicates, and impossible negative numbers) is essential before computing statistical aggregates.'
      }
    ]
  }
];

// ── Sample Datasets for Labs ───────────────────────────────────────────────

export const VISUALIZATION_DATASETS = {
  state_coverage: {
    title: 'State Survey Response Rates (%)',
    description: 'Comparison of field response rates achieved across major statistical state directorates.',
    xAxisKey: 'state',
    data: [
      { state: 'Andhra Pradesh', responseRate: 94.2, targetRate: 90.0, scrutinyPass: 91.5 },
      { state: 'Karnataka', responseRate: 88.5, targetRate: 90.0, scrutinyPass: 85.0 },
      { state: 'Tamil Nadu', responseRate: 96.1, targetRate: 90.0, scrutinyPass: 94.8 },
      { state: 'Kerala', responseRate: 92.4, targetRate: 90.0, scrutinyPass: 89.2 },
      { state: 'Maharashtra', responseRate: 86.8, targetRate: 90.0, scrutinyPass: 82.4 },
      { state: 'Gujarat', responseRate: 91.0, targetRate: 90.0, scrutinyPass: 88.0 },
    ],
    series: [
      { key: 'responseRate', name: 'Response Rate (%)', color: '#0284c7' },
      { key: 'targetRate', name: 'National Target (%)', color: '#94a3b8' },
      { key: 'scrutinyPass', name: 'Scrutiny Pass (%)', color: '#38bdf8' },
    ]
  },
  monthly_cpi: {
    title: 'Monthly Price Index Trends (12 Months)',
    description: 'Temporal trend tracking Consumer Price Index (CPI) and Wholesale Price Index (WPI).',
    xAxisKey: 'month',
    data: [
      { month: 'Jan', cpi: 178.2, wpi: 151.4 },
      { month: 'Feb', cpi: 179.0, wpi: 151.9 },
      { month: 'Mar', cpi: 180.1, wpi: 152.5 },
      { month: 'Apr', cpi: 181.5, wpi: 153.2 },
      { month: 'May', cpi: 182.4, wpi: 154.0 },
      { month: 'Jun', cpi: 183.8, wpi: 154.8 },
      { month: 'Jul', cpi: 185.0, wpi: 155.6 },
      { month: 'Aug', cpi: 184.6, wpi: 155.1 },
      { month: 'Sep', cpi: 184.2, wpi: 154.5 },
      { month: 'Oct', cpi: 185.4, wpi: 155.8 },
      { month: 'Nov', cpi: 186.2, wpi: 156.4 },
      { month: 'Dec', cpi: 187.0, wpi: 157.1 },
    ],
    series: [
      { key: 'cpi', name: 'Consumer Price Index (CPI)', color: '#0284c7' },
      { key: 'wpi', name: 'Wholesale Price Index (WPI)', color: '#64748b' },
    ]
  },
  survey_complexity: {
    title: 'Survey Completion Time vs Form Length',
    description: 'Assessing how schedule length impacts the average interview duration.',
    xAxisKey: 'modules',
    data: [
      { modules: '2 Modules', minutes: 22, scrutinyErrors: 1.2 },
      { modules: '4 Modules', minutes: 38, scrutinyErrors: 2.4 },
      { modules: '6 Modules', minutes: 54, scrutinyErrors: 4.1 },
      { modules: '8 Modules', minutes: 78, scrutinyErrors: 6.8 },
      { modules: '10 Modules', minutes: 110, scrutinyErrors: 11.5 },
    ],
    series: [
      { key: 'minutes', name: 'Avg Duration (Mins)', color: '#0284c7' },
      { key: 'scrutinyErrors', name: 'Avg Errors Detected', color: '#dc2626' },
    ]
  }
};

export const DISTRICT_ANALYSIS_DATASET = [
  { id: 'REC-001', district: 'Guntur', cadre: 'SSS', sampleSize: 120, completed: 116, returnRate: 96.7, qualityScore: 92, status: 'Verified' },
  { id: 'REC-002', district: 'Krishna', cadre: 'SSS', sampleSize: 140, completed: 138, returnRate: 98.6, qualityScore: 95, status: 'Verified' },
  { id: 'REC-003', district: 'Visakhapatnam', cadre: 'ISS', sampleSize: 180, completed: 168, returnRate: 93.3, qualityScore: 88, status: 'Verified' },
  { id: 'REC-004', district: 'Kurnool', cadre: 'SSS', sampleSize: 110, completed: 98, returnRate: 89.1, qualityScore: 74, status: 'Under Scrutiny' },
  { id: 'REC-005', district: 'Anantapur', cadre: 'SSS', sampleSize: 130, completed: 112, returnRate: 86.2, qualityScore: 71, status: 'Under Scrutiny' },
  { id: 'REC-006', district: 'Chittoor', cadre: 'ISS', sampleSize: 160, completed: 156, returnRate: 97.5, qualityScore: 94, status: 'Verified' },
  { id: 'REC-007', district: 'East Godavari', cadre: 'SSS', sampleSize: 150, completed: 147, returnRate: 98.0, qualityScore: 91, status: 'Verified' },
  { id: 'REC-008', district: 'West Godavari', cadre: 'SSS', sampleSize: 135, completed: 130, returnRate: 96.3, qualityScore: 89, status: 'Verified' },
  { id: 'REC-009', district: 'Kadapa', cadre: 'SSS', sampleSize: 105, completed: 88, returnRate: 83.8, qualityScore: 68, status: 'Under Scrutiny' },
  { id: 'REC-010', district: 'Nellore', cadre: 'ISS', sampleSize: 145, completed: 141, returnRate: 97.2, qualityScore: 93, status: 'Verified' },
  { id: 'REC-011', district: 'Prakasam', cadre: 'SSS', sampleSize: 125, completed: 118, returnRate: 94.4, qualityScore: 85, status: 'Verified' },
  { id: 'REC-012', district: 'Srikakulam', cadre: 'SSS', sampleSize: 100, completed: 92, returnRate: 92.0, qualityScore: 82, status: 'Verified' },
];
