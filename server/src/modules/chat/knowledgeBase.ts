/**
 * STATINTEL Local Educational Knowledge Base
 *
 * Provides comprehensive, structured knowledge for local fallback response generation
 * across data analysis, programming, statistics, machine learning, and STATINTEL competencies.
 */

export interface KnowledgeTopic {
  id: string;
  title: string;
  category: 'programming' | 'statistics' | 'data_analysis' | 'machine_learning' | 'competencies' | 'official_statistics';
  keywords: string[];
  summary: string;
  definition: string;
  howItWorks: string[];
  whyItMatters: string;
  example: {
    title: string;
    description: string;
    code?: string;
    scenario?: string;
  };
  practicalContext: string;
  nextSteps: string[];
  comparisons?: {
    comparedTo: string;
    keyDifferences: string[];
  };
}

export const KNOWLEDGE_BASE: KnowledgeTopic[] = [
  // ── 1. Python ──────────────────────────────────────────────────────────
  {
    id: 'python_programming',
    title: 'Python Programming',
    category: 'programming',
    keywords: ['python', 'py', 'python3', 'python code', 'scripting in python', 'python basics'],
    summary: 'A versatile, high-level, readable programming language that is the industry standard for data analysis, automation, and statistical computing.',
    definition: 'Python is an interpreted, dynamically-typed programming language known for its clean syntax and vast ecosystem of open-source packages for mathematical computing, data processing, and machine learning.',
    howItWorks: [
      'Executes code line-by-line via the Python bytecode interpreter.',
      'Supports procedural, object-oriented, and functional programming paradigms.',
      'Provides an extensive Standard Library alongside package management via pip and virtual environments.',
      'Integrates seamlessly with high-performance C and Fortran mathematical libraries (NumPy, SciPy).'
    ],
    whyItMatters: 'Python replaces tedious manual spreadsheet workflows with repeatable, auditable data processing scripts that can scale to millions of records without human transcription errors.',
    example: {
      title: 'Cleaning and Filtering Survey Data',
      description: 'Filter records with valid responses and calculate the average score using Python built-in features:',
      code: `# Sample survey responses: (Official ID, Score, State)
responses = [
    ("OFF_101", 85, "Andhra Pradesh"),
    ("OFF_102", None, "Telangana"),
    ("OFF_103", 92, "Andhra Pradesh"),
    ("OFF_104", 78, "Karnataka")
]

# Clean valid responses for Andhra Pradesh
valid = [r[1] for r in responses if r[2] == "Andhra Pradesh" and r[1] is not None]
avg_score = sum(valid) / len(valid) if valid else 0

print(f"Valid AP responses: {len(valid)}, Mean Score: {avg_score:.2f}")
# Output: Valid AP responses: 2, Mean Score: 88.50`
    },
    practicalContext: 'In government statistics and modern data analysis units (like MoSPI), Python scripts automate monthly district survey aggregations, outlier validation, and publication pipelines.',
    nextSteps: [
      'Master data structures: lists, dicts, tuples, and sets.',
      'Learn Pandas and NumPy for tabular data and array operations.',
      'Practice writing modular functions and automated data validation scripts.'
    ],
    comparisons: {
      comparedTo: 'C / C++ / Java',
      keyDifferences: [
        'Python uses dynamic typing and automatic memory management, making exploratory analysis much faster to write.',
        'C/C++ and Java require explicit compilation and verbose boilerplate code, but offer higher raw execution speed for low-level systems.',
        'Python is ideal for data manipulation and rapid prototyping, while compiled languages are often reserved for backend system architectures.'
      ]
    }
  },

  // ── 2. Programming Fundamentals ─────────────────────────────────────────
  {
    id: 'programming_fundamentals',
    title: 'Programming Fundamentals',
    category: 'programming',
    keywords: ['programming fundamentals', 'coding basics', 'functions', 'loops', 'conditionals', 'data structures', 'variables', 'algorithms'],
    summary: 'The core building blocks of computer programming: variables, flow control, functions, and data structures.',
    definition: 'Programming fundamentals are the foundational principles of instructing a computer to process inputs, maintain state, make logical decisions, and produce reproducible outputs.',
    howItWorks: [
      'Variables and Data Types: Hold values in memory (integers, floats, strings, booleans).',
      'Control Flow: Direct execution paths via conditionals (if/else) and iteration (for/while loops).',
      'Data Structures: Organize data efficiently (arrays, lists, maps/dictionaries, hash tables).',
      'Modularization: Package repetitive tasks into testable, reusable functions with parameter inputs and return values.'
    ],
    whyItMatters: 'Strong foundational logic allows you to transition between any language (such as Python, Java, or C++) and write resilient, bug-free data workflows.',
    example: {
      title: 'Categorizing Data Points with Conditional Functions',
      description: 'A modular function applying conditional classification logic:',
      code: `def classify_performance(score: float) -> str:
    """Classifies a score into standard evaluation tiers."""
    if score >= 85:
        return "EXEMPLARY"
    elif score >= 70:
        return "PROFICIENT"
    elif score >= 50:
        return "DEVELOPING"
    else:
        return "NEEDS_IMPROVEMENT"

scores = [92, 68, 74, 45, 88]
tiers = {s: classify_performance(s) for s in scores}
print(tiers)`
    },
    practicalContext: 'Data validation rules in survey software (such as checking whether household expenditure is within allowable positive bounds) rely directly on core control flow and functions.',
    nextSteps: [
      'Learn algorithmic time complexity (Big-O notation).',
      'Practice unit testing and boundary condition handling.',
      'Explore object-oriented patterns and data transformation pipelines.'
    ]
  },

  // ── 3. SQL ─────────────────────────────────────────────────────────────
  {
    id: 'sql_databases',
    title: 'SQL (Structured Query Language)',
    category: 'programming',
    keywords: ['sql', 'query', 'databases', 'relational database', 'select', 'join', 'group by', 'postgresql', 'mysql'],
    summary: 'The declarative language used to manage, query, aggregate, and transform relational data stored in databases.',
    definition: 'SQL is the standardized domain-specific language designed for interacting with Relational Database Management Systems (RDBMS) like PostgreSQL, MySQL, and SQLite.',
    howItWorks: [
      'Declarative syntax: You state WHAT data you want, and the database query planner determines HOW to retrieve it efficiently.',
      'Projection and Filtering: SELECT columns, WHERE conditions filter individual rows.',
      'Relational Joins: INNER, LEFT, RIGHT, and FULL joins connect records across normalized tables using primary and foreign keys.',
      'Aggregations: GROUP BY, HAVING, and aggregate functions (COUNT, SUM, AVG, MIN, MAX) compute summary statistics directly on the database engine.'
    ],
    whyItMatters: 'Enterprise data rarely sits in static Excel files; it resides in databases. SQL allows you to pull and aggregate millions of records in seconds before bringing subsets into analysis tools.',
    example: {
      title: 'District Competency Aggregation Query',
      description: 'Querying official counts and average scores grouped by department:',
      code: `SELECT 
    d."nameEn" AS department_name,
    COUNT(o.id) AS total_officials,
    ROUND(AVG(e.quality)::numeric, 2) AS avg_evidence_quality
FROM "Official" o
JOIN "Department" d ON o."departmentId" = d.id
LEFT JOIN "Evidence" e ON e."officialId" = o.id
GROUP BY d."nameEn"
HAVING COUNT(o.id) >= 5
ORDER BY avg_evidence_quality DESC;`
    },
    practicalContext: 'In government IT backends (including STATINTEL itself), SQL powers user authentication, role-based records, audit logging, and evidence ledger lookups.',
    nextSteps: [
      'Master relational JOIN mechanics (INNER vs. LEFT OUTER).',
      'Learn advanced aggregation: window functions (ROW_NUMBER(), RANK(), OVER(PARTITION BY)).',
      'Study indexing strategies (B-Tree, GIN) to optimize slow queries.'
    ],
    comparisons: {
      comparedTo: 'Pandas (Python)',
      keyDifferences: [
        'SQL runs directly inside the database server where data lives, avoiding network transfer overhead for massive datasets.',
        'Pandas runs in client memory (RAM) and provides superior support for machine learning, complex reshaping, and statistical modeling.',
        'Best practice: Use SQL to filter and aggregate large tables down to relevant cohorts, then load the result into Pandas for specialized analysis.'
      ]
    }
  },

  // ── 4. Statistics Fundamentals ──────────────────────────────────────────
  {
    id: 'statistics_fundamentals',
    title: 'Statistics Fundamentals',
    category: 'statistics',
    keywords: ['statistics', 'stats', 'descriptive statistics', 'inferential statistics', 'probability', 'distribution', 'sample', 'population'],
    summary: 'The scientific discipline of collecting, organizing, analyzing, interpreting, and presenting quantitative data.',
    definition: 'Statistics provides mathematical frameworks to summarize observed data (descriptive statistics) and draw valid inferences about broader populations from representative samples (inferential statistics).',
    howItWorks: [
      'Data Types: Categorical (nominal, ordinal) vs Numerical (discrete, continuous).',
      'Descriptive Measures: Central tendency (mean, median, mode) and dispersion (range, variance, standard deviation, IQR).',
      'Probability Distributions: Normal/Gaussian, Binomial, Poisson, and Student-t distributions describe likelihood of outcomes.',
      'Hypothesis Testing & Confidence: P-values, confidence intervals, and significance levels determine whether observed patterns are genuine or due to random chance.'
    ],
    whyItMatters: 'Without statistics, raw numbers can mislead. Statistical rigor ensures official policies and business decisions are based on measurable realities rather than noise or sampling biases.',
    example: {
      title: 'Population vs Sample Inference',
      description: 'Measuring a representative sample of 1,000 households to infer the consumption expenditure of an entire district with a 95% confidence interval.'
    },
    practicalContext: 'Government surveys (HCES, PLFS, ASHE) rely on statistical sampling theory to publish national economic indicators without having to conduct a full census every year.',
    nextSteps: [
      'Understand measures of central tendency and dispersion.',
      'Study the Central Limit Theorem and sampling distributions.',
      'Learn linear regression and hypothesis testing.'
    ]
  },

  // ── 5. Mean, Median, and Mode ──────────────────────────────────────────
  {
    id: 'statistics_mean_median_mode',
    title: 'Mean, Median, and Mode (Measures of Central Tendency)',
    category: 'statistics',
    keywords: ['mean', 'median', 'mode', 'central tendency', 'average', 'mean vs median', 'skewness', 'outliers'],
    summary: 'The three foundational metrics used to identify the central or typical value of a dataset.',
    definition: 'Measures of central tendency summarize an entire distribution of values with a single representative score located at the center of the distribution.',
    howItWorks: [
      'Mean (Arithmetic Average): The sum of all values divided by total count (Σx / n). Highly sensitive to extreme outliers.',
      'Median: The middle value when data is ordered from smallest to largest (50th percentile). Robust against outliers and skewed distributions.',
      'Mode: The most frequently occurring value in the dataset. Useful for categorical data.'
    ],
    whyItMatters: 'Choosing the wrong measure of center produces misleading conclusions. For example, average income is heavily distorted upwards by a few billionaires, whereas median income reflects the true typical citizen.',
    example: {
      title: 'Outlier Sensitivity Demonstration',
      description: 'Comparing Mean vs Median when a severe outlier enters the data:',
      code: `import statistics

salaries = [30000, 32000, 35000, 38000, 42000, 500000] # Note the 500,000 executive salary

mean_val = statistics.mean(salaries)     # 112,833 (Distorted upwards by outlier)
median_val = statistics.median(salaries) # 36,500  (Accurate reflection of typical staff)
mode_val = statistics.mode([1, 2, 2, 3]) # 2

print(f"Mean: {mean_val:.0f} | Median: {median_val:.0f}")`
    },
    practicalContext: 'Official statistical agencies report median household income and expenditure because economic wealth distributions are heavily right-skewed.',
    nextSteps: [
      'Learn about distribution skewness (left-skewed vs. right-skewed).',
      'Pair measures of center with measures of spread (Standard Deviation and IQR).',
      'Study trimmed means and robust statistics.'
    ],
    comparisons: {
      comparedTo: 'Mean vs Median',
      keyDifferences: [
        'Use the Mean when the data distribution is symmetric (normal bell curve) with no significant outliers.',
        'Use the Median when data is skewed (income, house prices, web traffic) or contains extreme outliers.',
        'If Mean > Median, the distribution is right-skewed (tail extends towards higher values).'
      ]
    }
  },

  // ── 6. Standard Deviation & Variance ────────────────────────────────────
  {
    id: 'statistics_standard_deviation',
    title: 'Standard Deviation and Variance (Measures of Dispersion)',
    category: 'statistics',
    keywords: ['standard deviation', 'variance', 'dispersion', 'spread', 'std dev', 'sigma', 'variability', 'iqr'],
    summary: 'Quantifies how spread out numbers are from their arithmetic mean.',
    definition: 'Standard deviation (σ for population, s for sample) is the square root of variance, measuring the typical distance between data points and the distribution mean in the original units of measurement.',
    howItWorks: [
      'Calculate the mean of the dataset.',
      'Compute each point’s deviation from the mean (x - μ).',
      'Square each deviation to eliminate negative signs and penalize larger discrepancies.',
      'Average the squared deviations to obtain Variance (σ²).',
      'Take the square root of variance to return to the original unit scale (Standard Deviation σ).'
    ],
    whyItMatters: 'Two datasets can have the exact same mean of 50, but one has values between 48–52 (low risk, consistent) while the other has values between 0–100 (high risk, volatile). Standard deviation reveals this hidden variation.',
    example: {
      title: 'Comparing Consistency Across Two Teams',
      description: 'Calculating sample standard deviation in Python:',
      code: `import numpy as np

team_a = np.array([49, 50, 51, 50, 50]) # Consistent output
team_b = np.array([10, 30, 50, 70, 90]) # Highly variable output

print(f"Team A Mean: {team_a.mean()}, Std Dev: {team_a.std():.2f}")
# Output: Mean: 50.0, Std Dev: 0.63

print(f"Team B Mean: {team_b.mean()}, Std Dev: {team_b.std():.2f}")
# Output: Mean: 50.0, Std Dev: 28.28`
    },
    practicalContext: 'In survey quality control, high standard deviation in enumerator completion times often identifies interviewers who are either rushing through forms or encountering difficult respondents.',
    nextSteps: [
      'Learn the 68-95-99.7 Empirical Rule for normal distributions.',
      'Understand Z-scores for identifying statistical outliers.',
      'Explore standard error of the mean (SEM).'
    ]
  },

  // ── 7. Data Analysis ───────────────────────────────────────────────────
  {
    id: 'data_analysis_workflow',
    title: 'Data Analysis and Analytical Workflow',
    category: 'data_analysis',
    keywords: ['data analysis', 'eda', 'exploratory data analysis', 'data cleaning', 'analytics', 'insights'],
    summary: 'The systematic process of inspecting, cleaning, transforming, and modeling data to discover useful insights and support decision-making.',
    definition: 'Data analysis is the multi-stage discipline of turning raw, messy records into structured, validated intelligence through rigorous computation, exploratory analysis, and clear reporting.',
    howItWorks: [
      '1. Ingestion & Scrutiny: Import raw tabular or semi-structured data; check schema and missing values.',
      '2. Cleaning & Imputation: Handle nulls, format dates, standardize codes, and remove duplicate records.',
      '3. Exploratory Data Analysis (EDA): Compute descriptive metrics, check correlation matrices, and inspect distributions with histograms/boxplots.',
      '4. Synthesis & Insight Delivery: Answer business or policy questions with quantified metrics and visual dashboards.'
    ],
    whyItMatters: 'Over 70% of real-world analysis time is spent cleaning and validating data. Solid analytical workflows prevent flawed data from driving incorrect real-world decisions.',
    example: {
      title: 'Exploratory Pipeline in Python',
      description: 'An end-to-end data analysis inspection pattern:',
      code: `import pandas as pd

# Load survey returns
df = pd.read_csv("district_survey.csv")

# 1. Inspect structure
print(df.info())

# 2. Check missing values
print(df.isnull().sum())

# 3. Statistical summary of numeric indicators
print(df.describe())

# 4. Filter and aggregate
summary = df.groupby("zone")["expenditure"].agg(["count", "mean", "median"])
print(summary)`
    },
    practicalContext: 'Policy makers use data analysis on national sample surveys to allocate funding for rural health, infrastructure, and nutrition subsidies.',
    nextSteps: [
      'Learn the Pandas library for fast tabular wrangling.',
      'Build dashboards with Matplotlib and Seaborn.',
      'Study SQL and relational data extraction.'
    ]
  },

  // ── 8. Pandas ──────────────────────────────────────────────────────────
  {
    id: 'python_pandas',
    title: 'Pandas (Python Data Analysis Library)',
    category: 'data_analysis',
    keywords: ['pandas', 'dataframe', 'series', 'read_csv', 'groupby', 'merge', 'loc', 'iloc'],
    summary: 'The primary Python library providing fast, flexible data structures (DataFrames) designed for real-world tabular data manipulation.',
    definition: 'Pandas is an open-source Python library offering high-performance data manipulation and analysis tools, centered around the two-dimensional DataFrame structure with labeled axes (rows and columns).',
    howItWorks: [
      'Series: 1D labeled array capable of holding any data type.',
      'DataFrame: 2D labeled data structure with columns of potentially different types, resembling an SQL table or spreadsheet.',
      'Indexing & Slicing: Uses .loc[] for label-based selection and .iloc[] for integer-position selection.',
      'Grouping & Reshaping: Powerful .groupby(), .pivot_table(), and .merge() operations allow complex relational aggregations.'
    ],
    whyItMatters: 'Pandas provides in a few lines of code what would take dozens of lines in native Python, operating at C-speed thanks to its underlying NumPy architecture.',
    example: {
      title: 'Grouping and Aggregating Data with Pandas',
      description: 'Group official records by cadre and calculate competency averages:',
      code: `import pandas as pd

data = {
    'name': ['Anitha', 'Vinay', 'Rajesh', 'Sunita', 'Prakash'],
    'cadre': ['SSS', 'SSS', 'ISS', 'ISS', 'SSS'],
    'score': [82, 88, 91, 95, 76]
}

df = pd.DataFrame(data)

# Calculate mean and count per cadre
report = df.groupby('cadre')['score'].agg(
    officials='count',
    avg_score='mean'
).reset_index()

print(report)`
    },
    practicalContext: 'Government data units use Pandas to automate the ingestion of raw district survey spreadsheets, merge them against master departmental code lists, and export clean validation tables.',
    nextSteps: [
      'Learn method chaining with .query() and .assign().',
      'Handle missing values using .fillna() and .dropna().',
      'Learn date parsing and time-series resample operations.'
    ]
  },

  // ── 9. NumPy ───────────────────────────────────────────────────────────
  {
    id: 'python_numpy',
    title: 'NumPy (Numerical Python)',
    category: 'data_analysis',
    keywords: ['numpy', 'ndarray', 'matrix', 'vector', 'array', 'vectorization', 'linear algebra', 'numerical python'],
    summary: 'The foundational scientific computing package for Python, powering multidimensional array operations and high-performance linear algebra.',
    definition: 'NumPy is the core library for scientific computing in Python, providing a high-performance multidimensional array object (ndarray), mathematical functions, linear algebra routines, and random number capabilities.',
    howItWorks: [
      'ndarray: Contiguous memory buffer holding homogeneous data elements for maximum CPU cache efficiency.',
      'Vectorization: Replaces slow Python for-loops with pre-compiled C loops running element-wise operations.',
      'Broadcasting: Allows arithmetic operations between arrays of different compatible shapes without copying data.',
      'Universal Functions (ufuncs): Fast mathematical functions (sin, exp, log, sqrt) executed over arrays.'
    ],
    whyItMatters: 'Virtually the entire Python data science stack (Pandas, Scikit-Learn, PyTorch, TensorFlow) is built on top of NumPy arrays. Understanding NumPy gives you an intuition for vector math and computational efficiency.',
    example: {
      title: 'Vectorized Arithmetic vs Python Loops',
      description: 'Multiplying an array of weights by scores without a loop:',
      code: `import numpy as np

scores = np.array([85.0, 92.0, 78.0, 90.0])
weights = np.array([0.2, 0.3, 0.25, 0.25])

# Vectorized dot product (instant computation in C)
final_score = np.dot(scores, weights)
print(f"Weighted Competency Score: {final_score:.2f}")
# Output: Weighted Competency Score: 86.60`
    },
    practicalContext: 'In STATINTEL, the vector search engine computes cosine similarity between chunk embeddings and competency descriptions using vectorized dot-product math.',
    nextSteps: [
      'Learn array slicing, reshaping, and stacking.',
      'Understand broadcasting rules.',
      'Study matrix multiplication and linear algebra routines (np.linalg).'
    ]
  },

  // ── 10. Data Visualization ─────────────────────────────────────────────
  {
    id: 'data_visualization',
    title: 'Data Visualization and Dashboards',
    category: 'data_analysis',
    keywords: ['data visualization', 'charts', 'graphs', 'matplotlib', 'seaborn', 'plots', 'dashboard', 'recharts'],
    summary: 'The graphical representation of quantitative information to communicate findings clearly and efficiently.',
    definition: 'Data visualization translates complex numerical datasets into visual encodings (bars, lines, scatter points, heatmaps, radar plots) that leverage human visual perception to spot trends, clusters, and outliers.',
    howItWorks: [
      'Choose the right chart for the data relationship: categorical comparison (Bar chart), trend over time (Line chart), distribution (Histogram/Boxplot), relationship (Scatter plot), multivariate profile (Radar plot).',
      'Maintain visual hierarchy: Use consistent color encodings, clear axis labels, and sensible sorting.',
      'Avoid chart junk: Minimize 3D effects, unnecessary grid lines, and decorative elements that distort proportions.'
    ],
    whyItMatters: 'A well-crafted chart conveys critical findings to department directors and non-technical stakeholders faster than any dense table of statistical coefficients.',
    example: {
      title: 'Bar Chart Comparison Pattern',
      description: 'Creating a clean competency comparison plot with Matplotlib:',
      code: `import matplotlib.pyplot as plt

domains = ['Statistics', 'Technology', 'Governance', 'Behavioral']
current = [2.8, 1.4, 3.1, 2.5]
target = [3.0, 3.0, 3.0, 3.0]

x = range(len(domains))
plt.bar([i - 0.2 for i in x], current, width=0.4, label='Current Score', color='#10b981')
plt.bar([i + 0.2 for i in x], target, width=0.4, label='Target Requirement', color='#94a3b8')

plt.xticks(x, domains)
plt.ylabel('Competency Level (1-4)')
plt.title('Learner Competency Domain Gaps')
plt.legend()
plt.tight_layout()
plt.show()`
    },
    practicalContext: 'In STATINTEL, radar charts plot official domain mastery (STAT, TECH, GOVN, BEHV) against benchmark role targets to immediately highlight where training interventions are needed.',
    nextSteps: [
      'Master Matplotlib and Seaborn in Python.',
      'Learn business intelligence tools like Power BI or Tableau.',
      'Study interactive dashboard development with Recharts or Plotly.'
    ]
  },

  // ── 11. Machine Learning Fundamentals ──────────────────────────────────
  {
    id: 'machine_learning_fundamentals',
    title: 'Machine Learning Fundamentals',
    category: 'machine_learning',
    keywords: ['machine learning', 'ml', 'supervised learning', 'unsupervised learning', 'classification', 'regression', 'model', 'training'],
    summary: 'The study of computer algorithms that improve automatically through experience and data without being explicitly programmed.',
    definition: 'Machine learning develops statistical algorithms that identify patterns in historical training data and generalize to make predictions or decisions on unseen future data.',
    howItWorks: [
      'Supervised Learning: Trained on labeled input-output pairs (Regression predicts numbers, Classification predicts categories).',
      'Unsupervised Learning: Discovers hidden structures in unlabeled data (Clustering, Dimensionality Reduction).',
      'Train-Test Split: Data is divided (e.g. 80/20) to evaluate generalization performance and prevent overfitting.',
      'Evaluation Metrics: Accuracy, Precision, Recall, F1-Score for classification; RMSE and R² for regression.'
    ],
    whyItMatters: 'Machine learning automates complex predictive tasks, from detecting fraudulent transactions to categorizing free-text survey responses at national scale.',
    example: {
      title: 'Supervised Classification with Scikit-Learn',
      description: 'Training a basic classifier in Python:',
      code: `from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# Features X and Target y (e.g., whether household has electricity)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

predictions = model.predict(X_test)
print(classification_report(y_test, predictions))`
    },
    practicalContext: 'Modern statistical offices use ML algorithms to automate survey questionnaire coding (e.g., mapping text job descriptions to National Classification of Occupations codes).',
    nextSteps: [
      'Learn Scikit-Learn fundamentals.',
      'Understand the bias-variance tradeoff and cross-validation.',
      'Explore decision trees, random forests, and gradient boosting.'
    ]
  },

  // ── 12. Competencies & Assessment ──────────────────────────────────────
  {
    id: 'statintel_competencies',
    title: 'STATINTEL Competency Framework',
    category: 'competencies',
    keywords: ['competency', 'competencies', 'competency score', 'anchors', 'levels', 'l1', 'l2', 'l3', 'l4', 'domain', 'rubric'],
    summary: 'The standardized capability taxonomy for India’s Official Statistical System across Statistical, Technical, Governance, and Behavioral domains.',
    definition: 'In STATINTEL, a competency is a verifiable cluster of knowledge, skills, and observable behaviors required to execute official statistical and analytical functions.',
    howItWorks: [
      '4 Competency Domains: STAT (Statistical Methods), TECH (Technology & Tools), GOVN (Governance & Ethics), and BEHV (Behavioral & Leadership).',
      '4 Anchor Levels: Level 1 (Foundational Knowledge), Level 2 (Supervised Application), Level 3 (Autonomous Delivery), Level 4 (Strategic & Expert Mastery).',
      'Scoring Scale: Continuous 0–100 score mapped to levels (L1: 25+, L2: 50+, L3: 75+, L4: 90+).',
      'Evidence Ledger: Scores are calculated purely from dated evidence items (assessments, project artifacts, course completions) with mathematical exponential time decay.'
    ],
    whyItMatters: 'Instead of relying on arbitrary annual reviews or self-assessments, competency scores provide transparent, auditable proof of capability that stands up to CAG inspection.',
    example: {
      title: 'Anchor Level Progression in Python (TECH.PY.BASIC)',
      description: '• Level 1: Knows Python syntax, data types, and can run simple scripts.\n• Level 2: Writes functions to clean tabular data with supervisor guidance.\n• Level 3: Independently develops end-to-end data cleaning and validation pipelines.\n• Level 4: Designs reusable Python packages and architects automated data platforms for the division.'
    },
    practicalContext: 'Officers use competency profiles to understand exact qualification benchmarks for promotions and role transitions (such as moving from Junior Statistical Officer to Senior Statistical Officer or Data Analyst).',
    nextSteps: [
      'Inspect your competency radar on the Dashboard.',
      'Take target assessments on the Assessment page to verify level mastery.',
      'Review level anchors on the Competency Map (/graph).'
    ]
  },

  // ── 13. Skill Gaps ─────────────────────────────────────────────────────
  {
    id: 'statintel_skill_gaps',
    title: 'Skill Gap Analysis and Prioritization',
    category: 'competencies',
    keywords: ['skill gap', 'skill gaps', 'gaps', 'severity', 'criticality', 'urgency', 'gap analysis', 'explain my skill gaps'],
    summary: 'The mathematical difference between an official’s current evidenced competency score and the benchmark target required by their role profile.',
    definition: 'A skill gap represents an unmet capability requirement. In STATINTEL, gaps are ranked using a multi-factor formula combining severity, role criticality, and survey calendar urgency.',
    howItWorks: [
      'Gap Magnitude: Target Score required by RoleProfile minus Current Evidenced Score.',
      'Severity Band: CRITICAL (gap > 35 points), MODERATE (gap 15–35 points), MINOR (gap < 15 points).',
      'Role Criticality: Level 1 to 3 indicating how essential the competency is for daily role duties.',
      'Calendar Urgency: Multiplier applied when a national survey (e.g., HCES or PLFS) scheduled in the official survey calendar requires that specific competency within the next 90 days.',
      'Priority Ranking: Sorted by Severity × Criticality × Urgency so learners focus on what matters most first.'
    ],
    whyItMatters: 'Training budgets and learner time are finite. Prioritizing gaps ensures officials upskill in high-impact areas before critical survey rounds or production deadlines.',
    example: {
      title: 'Prioritizing a Gap in Field Supervision',
      description: 'If an official has a score of 42 on STAT.SURV.FIELD (Target: 75), the gap is 33 points (Moderate). However, because an HCES survey round starts in 45 days, its urgency jumps to 2.0x, elevating it to the #1 priority on their dashboard.'
    },
    practicalContext: 'Directors and administrators use aggregate skill gap heatmaps across states to deploy targeted NSSTA training cohorts where institutional weaknesses exist.',
    nextSteps: [
      'Navigate to the Skill Gaps page (/gaps) to view your ranked list.',
      'Start with the top-ranked Critical gap.',
      'Enroll in recommended iGOT or NSSTA modules aligned with that competency.'
    ]
  },

  // ── 14. Personalized Learning Paths ────────────────────────────────────
  {
    id: 'statintel_learning_paths',
    title: 'Personalized Learning Paths and DAG Sequencing',
    category: 'competencies',
    keywords: ['learning path', 'path', 'what should i learn next', 'course', 'curriculum', 'prerequisites', 'dag', 'sequence'],
    summary: 'A prerequisite-aware, topological sequence of learning modules engineered to close an official’s highest-priority skill gaps.',
    definition: 'A learning path in STATINTEL is a directed acyclic graph (DAG) traversal that generates an optimal sequence of courses, ensuring prerequisites are mastered before advanced competencies are introduced.',
    howItWorks: [
      'Identifies target competencies from open skill gaps.',
      'Walks prerequisite edges in the national competency ontology (e.g., Python Basics MUST be learned before Machine Learning).',
      'Performs topological sorting to produce a strict, step-by-step curriculum.',
      'Pairs each milestone with accredited courses from iGOT Karmayogi and NSSTA.'
    ],
    whyItMatters: 'Attempting advanced coursework without prerequisites leads to frustration and high drop-out rates. Topological sequencing guarantees sustainable learning progression.',
    example: {
      title: 'Sample Data Analyst Transition Path',
      description: '1. Step 1: TECH.PY.BASIC (Python Fundamentals)\n2. Step 2: TECH.SPREAD (Advanced Spreadsheets & Formulae)\n3. Step 3: TECH.SQL (Relational Database Querying)\n4. Step 4: TECH.PY.DATA (Data Wrangling with Pandas & NumPy)\n5. Step 5: STAT.SAMP.BASIC (Survey Sampling & Weights)'
    },
    practicalContext: 'Officials track completed modules on the Learning Path page (/path), and completed courses automatically log verifiable evidence in the Evidence Ledger.',
    nextSteps: [
      'Check your active Learning Path at /path.',
      'Focus on completing Step 1 before advancing to subsequent stages.',
      'Take a validation quiz after finishing course material to record evidence.'
    ]
  },

  // ── 15. Official & Government Statistics ────────────────────────────────
  {
    id: 'official_statistics',
    title: 'Official Statistics and Survey Methodology',
    category: 'official_statistics',
    keywords: ['official statistics', 'mospi', 'nsso', 'nssta', 'survey', 'hces', 'plfs', 'sampling', 'gsbpm', 'data quality', 'confidentiality'],
    summary: 'The methodologies, standards, and ethical frameworks governing national surveys and economic indices in India.',
    definition: 'Official statistics comprise quantitative data produced by national statistical agencies (such as MoSPI in India) following scientific standards to serve public policy, research, and national governance.',
    howItWorks: [
      'GSBPM (Generic Statistical Business Process Model): Specify needs → Design → Build → Collect → Process → Analyze → Disseminate → Evaluate.',
      'Major Surveys: HCES (Household Consumption Expenditure Survey), PLFS (Periodic Labour Force Survey), ASI (Annual Survey of Industries).',
      'Quality & Confidentiality: Regulated by statistical disclosure control, the DPDP Act 2023, and public trust protocols.',
      'Sampling Frameworks: Stratified multistage sampling designs ensure states and demographic cohorts are accurately represented.'
    ],
    whyItMatters: 'National economic measures like GDP, CPI inflation, and unemployment depend directly on the integrity, rigor, and impartiality of official statistical surveys.',
    example: {
      title: 'Field Scrutiny and Quality Verification',
      description: 'Before survey schedules are accepted into district data aggregates, scrutiny officers verify that reported consumption expenditures align with household size and cross-check records against local price indices.'
    },
    practicalContext: 'STATINTEL was built specifically to uplift capabilities within MoSPI, state Directorates of Economics and Statistics (DES), and NSSTA training institutes.',
    nextSteps: [
      'Review GSBPM phases mapped on your Competency Map.',
      'Explore mandatory modules on Data Quality and DPDP Act 2023 compliance.',
      'Learn survey sampling weighting methods (STAT.SAMP.WEIGHT).'
    ]
  }
];
