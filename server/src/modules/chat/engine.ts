import { KNOWLEDGE_BASE, type KnowledgeTopic } from './knowledgeBase.js';

export interface LearnerContext {
  nameEn: string;
  currentJobRole: string;
  desiredJobRole: string;
  skills: string[];
}

export type IntentType =
  | 'LEARNING_PATH'
  | 'SKILL_GAPS'
  | 'COMPARISON'
  | 'EXAMPLE'
  | 'DEFINITION'
  | 'EXPLANATION'
  | 'GENERAL';

interface TopicMatch {
  topic: KnowledgeTopic;
  score: number;
}

/**
 * Detects the learner's intent/question style.
 */
export function detectIntent(query: string): IntentType {
  const q = query.toLowerCase().trim();

  if (
    q.includes('what should i learn') ||
    q.includes('learning path') ||
    q.includes('where should i start') ||
    q.includes('how to become') ||
    q.includes('roadmap') ||
    q.includes('next skill')
  ) {
    return 'LEARNING_PATH';
  }

  if (
    q.includes('skill gap') ||
    q.includes('my gaps') ||
    q.includes('explain my gap') ||
    q.includes('gap analysis')
  ) {
    return 'SKILL_GAPS';
  }

  if (
    q.includes('difference between') ||
    q.includes(' vs ') ||
    q.includes(' versus ') ||
    q.includes('compare ') ||
    q.includes('compared to')
  ) {
    return 'COMPARISON';
  }

  if (
    q.includes('example') ||
    q.includes('show code') ||
    q.includes('sample code') ||
    q.includes('code snippet') ||
    q.includes('give me an example')
  ) {
    return 'EXAMPLE';
  }

  if (
    q.startsWith('what is') ||
    q.startsWith("what's") ||
    q.startsWith('define ') ||
    q.startsWith('meaning of') ||
    q.includes('what does')
  ) {
    return 'DEFINITION';
  }

  if (
    q.startsWith('explain ') ||
    q.startsWith('how does ') ||
    q.startsWith('how do ') ||
    q.startsWith('why is ') ||
    q.startsWith('why does ')
  ) {
    return 'EXPLANATION';
  }

  return 'GENERAL';
}

/**
 * Scores and retrieves top-matching knowledge topics for a query.
 */
export function matchTopics(query: string): TopicMatch[] {
  const normalized = query.toLowerCase().replace(/[^\w\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2);

  const scored = KNOWLEDGE_BASE.map((topic) => {
    let score = 0;

    // Check keyword exact phrase matches
    for (const kw of topic.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += 15;
      }
    }

    // Check title exact or token match
    const titleNorm = topic.title.toLowerCase();
    if (normalized.includes(titleNorm)) {
      score += 20;
    }

    for (const token of tokens) {
      // Direct token match in title
      if (titleNorm.includes(token)) {
        score += 6;
      }
      // Match in keywords
      for (const kw of topic.keywords) {
        if (kw.includes(token)) {
          score += 3;
        }
      }
      // Match in summary / definition
      if (topic.summary.toLowerCase().includes(token)) {
        score += 1;
      }
    }

    return { topic, score };
  });

  return scored
    .filter((m) => m.score >= 5)
    .sort((a, b) => b.score - a.score);
}

/**
 * Builds a tailored learning path response based on the learner's actual profile.
 */
function buildPersonalizedLearningPath(ctx: LearnerContext): string {
  const firstName = ctx.nameEn.split(' ')[0] || 'Learner';
  const current = ctx.currentJobRole || 'Software Engineer';
  const desired = ctx.desiredJobRole || 'Data Analyst';
  const known = ctx.skills.length > 0 ? ctx.skills.join(', ') : 'standard software tools';

  return `Hello **${firstName}**! Here is a recommended, high-impact learning path to transition from your current role (**${current}**) to your desired role (**${desired}**).

### Your Current Foundation:
* **Current Background:** ${current}
* **Target Objective:** ${desired}
* **Identified Skills:** ${known}

Because you already possess a foundation in programming, you do not need to start from scratch. Your focus should be on **data manipulation, relational database querying, business intelligence, and applied statistical inference**.

---

### Step-by-Step Pathway to ${desired}:

#### 1. SQL & Relational Database Mastery (Priority #1)
Data Analysts extract the vast majority of their working data from relational databases.
* **Core Topics:** Multi-table \`JOIN\` operations, \`GROUP BY\` aggregations, window functions (\`RANK()\`, \`PARTITION BY\`), subqueries, and database indexing.
* **STATINTEL Competency:** \`TECH.SQL\` (Relational Databases & Query Optimization).
* **Recommended Next Step:** Practice writing complex analytical queries on multi-table datasets.

#### 2. Tabular Data Manipulation with Pandas & NumPy
Leverage your existing programming experience to wrangle and clean real-world datasets.
* **Core Topics:** DataFrame slicing (\`.loc\`, \`.iloc\`), handling missing records (\`.fillna\`, \`.dropna\`), group-wise operations (\`.groupby\`), and joining datasets (\`.merge\`).
* **STATINTEL Competency:** \`TECH.PY.DATA\` (Data Analysis with Python).
* **Recommended Next Step:** Build a script that ingests messy survey/transaction files and outputs standardized summary tables.

#### 3. Data Visualization & Dashboarding
Transform numbers into clear, actionable stories for departmental directors and stakeholders.
* **Core Topics:** Matplotlib & Seaborn in Python; interactive business intelligence platforms like Power BI or Tableau.
* **STATINTEL Competency:** \`TECH.SPREAD\` and \`TECH.PY.DATA\`.
* **Recommended Next Step:** Create a 4-chart executive dashboard visualizing trends, distributions, and outliers.

#### 4. Applied Statistics & Survey Methodology
Ensure conclusions are mathematically valid rather than artifacts of noise or sampling bias.
* **Core Topics:** Central tendency (Mean vs Median), Dispersion (Standard Deviation, Variance), Confidence Intervals, and Stratified Sampling.
* **STATINTEL Competency:** \`STAT.FOUND.DESC\` (Descriptive Statistics) & \`STAT.SAMP.BASIC\` (Survey Sampling).

---

### What to Do Today:
Navigate to the **Learning Path** page (\`/path\`) or **Skill Gaps** page (\`/gaps\`) on your dashboard to see your specific course sequence and enroll in corresponding iGOT Karmayogi / NSSTA modules.`;
}

/**
 * Builds a clear, educational explanation of the learner's skill gaps.
 */
function buildPersonalizedSkillGapsResponse(ctx: LearnerContext): string {
  const firstName = ctx.nameEn.split(' ')[0] || 'Learner';
  const desired = ctx.desiredJobRole || 'Data Analyst';

  return `Hello **${firstName}**! Here is an explanation of how skill gaps work in STATINTEL and how they guide your journey toward **${desired}**.

### What Is a Skill Gap?
In STATINTEL, a **Skill Gap** is the mathematical difference between your **Current Evidenced Score** (computed from your Evidence Ledger) and the **Target Level** required by your role profile.

\`\`\`
Skill Gap = Target Level Required - Current Evidenced Score
\`\`\`

### How Gaps Are Ranked on Your Dashboard:
Your dashboard does not just show gaps alphabetically; it prioritizes them using three factors:
1. **Severity (Magnitude):** How far your current score is from the target level.
   * **CRITICAL:** Deficit of > 35 points (requires structured coursework).
   * **MODERATE:** Deficit of 15–35 points (can be closed with focused exercises).
   * **MINOR:** Deficit of < 15 points (nearly proficient; ready for validation).
2. **Role Criticality:** Rated 1 to 3 based on how essential that competency is for daily tasks in India's Statistical System.
3. **Calendar Urgency:** Multiplier increased when an upcoming national survey round (e.g. HCES or PLFS) requires that competency within the next 90 days.

### How to Close Your Gaps:
* **Step 1:** Review your highest-ranked **Critical** gap on the \`/gaps\` page.
* **Step 2:** Complete the accredited iGOT or NSSTA modules recommended on your \`/path\` page.
* **Step 3:** Take a verification quiz on the **Assessment** page (\`/assess\`) to automatically log new evidence into your immutable Evidence Ledger.`;
}

/**
 * Builds a topic comparison response when comparing two related concepts.
 */
function buildComparisonResponse(topicA: KnowledgeTopic, topicB: KnowledgeTopic): string {
  return `### Comparison: ${topicA.title} vs. ${topicB.title}

Both **${topicA.title}** and **${topicB.title}** are essential components in data analysis and statistics, but they serve distinct purposes.

---

### 1. Conceptual Distinction
* **${topicA.title}:** ${topicA.definition}
* **${topicB.title}:** ${topicB.definition}

---

### 2. When to Use Which:
* **Use ${topicA.title} when:**
${topicA.howItWorks.slice(0, 2).map((pt) => `  - ${pt}`).join('\n')}

* **Use ${topicB.title} when:**
${topicB.howItWorks.slice(0, 2).map((pt) => `  - ${pt}`).join('\n')}

---

### 3. Practical Example:
${topicA.example.description}
\`\`\`python
# ${topicA.title} Focus
${topicA.example.code || topicA.example.scenario || 'See topic documentation for full code snippet.'}
\`\`\`

---

### Key Takeaway:
* **${topicA.title}** is focused on ${topicA.summary.toLowerCase()}
* **${topicB.title}** is focused on ${topicB.summary.toLowerCase()}`;
}

/**
 * Builds a comprehensive educational response for a single topic.
 */
function buildTopicResponse(topic: KnowledgeTopic, intent: IntentType, ctx: LearnerContext): string {
  const firstName = ctx.nameEn.split(' ')[0] || 'Learner';

  let greeting = '';
  if (intent === 'DEFINITION' || intent === 'EXPLANATION' || intent === 'EXAMPLE') {
    greeting = `Hello **${firstName}**! Here is an overview of **${topic.title}**:\n\n`;
  }

  let content = `${greeting}### ${topic.title}

**Overview:**  
${topic.definition}

---

### How It Works:
${topic.howItWorks.map((pt) => `* ${pt}`).join('\n')}

---

### Why It Matters:
${topic.whyItMatters}
`;

  // Include example if available
  if (topic.example) {
    content += `\n---\n\n### Practical Example: ${topic.example.title}\n${topic.example.description}\n`;
    if (topic.example.code) {
      content += `\n\`\`\`python\n${topic.example.code}\n\`\`\`\n`;
    }
  }

  // Include practical context
  if (topic.practicalContext) {
    content += `\n**Real-World Application:**  
${topic.practicalContext}\n`;
  }

  // Include comparison if relevant
  if (topic.comparisons) {
    content += `\n**Key Comparison (${topic.comparisons.comparedTo}):**  
${topic.comparisons.keyDifferences.map((d) => `* ${d}`).join('\n')}\n`;
  }

  // Include next steps
  if (topic.nextSteps && topic.nextSteps.length > 0) {
    content += `\n---

### Next Recommended Steps:
${topic.nextSteps.map((step) => `1. ${step}`).join('\n')}
`;
  }

  return content;
}

/**
 * Honest response when a query is outside the local knowledge base.
 */
function buildUnknownTopicResponse(query: string, ctx: LearnerContext): string {
  const desired = ctx.desiredJobRole || 'your target role';

  return `I am currently operating in offline mode using the built-in **STATINTEL Educational Knowledge Base** because the external AI service is temporarily unavailable. 

The local knowledge base does not currently contain detailed educational material for:
> *"${query.slice(0, 100)}"*

### Topics I can thoroughly explain for you right now:
* **Programming & Tools:** Python Basics, Programming Fundamentals, SQL & Relational Databases, Pandas, NumPy, Data Visualization.
* **Statistics & Analytics:** Descriptive Statistics, Mean vs. Median vs. Mode, Standard Deviation & Variance, Exploratory Data Analysis (EDA), Machine Learning Fundamentals.
* **STATINTEL Development:** Competency Anchor Levels (L1–L4), Skill Gap Calculations & Severity, Personalized Learning Paths for **${desired}**, and Survey Calendar Deadlines.
* **Official Statistics:** GSBPM Methodology, Survey Quality Scrutiny (HCES, PLFS), and Sampling Fundamentals.

Please feel free to ask a question on any of the core topics above!`;
}

/**
 * Main entrance point for generating a local fallback response.
 */
export function generateLocalFallbackResponse(query: string, ctx: LearnerContext): string {
  const intent = detectIntent(query);

  // 1. Personalized learning path request
  if (intent === 'LEARNING_PATH') {
    return buildPersonalizedLearningPath(ctx);
  }

  // 2. Personalized skill gaps explanation
  if (intent === 'SKILL_GAPS') {
    return buildPersonalizedSkillGapsResponse(ctx);
  }

  // 3. Match against local knowledge topics
  const matches = matchTopics(query);

  const first = matches[0];
  const second = matches[1];

  // If intent is comparison and we have at least 2 distinct topics matching
  if (intent === 'COMPARISON' && first && second) {
    return buildComparisonResponse(first.topic, second.topic);
  }

  // If we have a high-confidence single topic match
  if (first && first.score >= 8) {
    return buildTopicResponse(first.topic, intent, ctx);
  }

  // Special checks for common single-word or short queries
  const qLower = query.toLowerCase();
  for (const topic of KNOWLEDGE_BASE) {
    if (qLower.includes(topic.id.replace(/_/g, ' ')) || topic.keywords.some((k) => qLower.includes(k))) {
      return buildTopicResponse(topic, intent, ctx);
    }
  }

  // Honest fallback when knowledge is insufficient
  return buildUnknownTopicResponse(query, ctx);
}
