export const en = {
  // Common Navigation
  'nav.dashboard': 'Dashboard',
  'nav.skillGaps': 'Skill gaps',
  'nav.learningPath': 'Learning path',
  'nav.assessment': 'Assessment',
  'nav.learningAssistant': 'Learning Assistant',
  'nav.virtualLab': 'Virtual Lab',
  'nav.futureSkills': 'Future Skills',
  'nav.recommendations': 'Recommendations',
  'nav.competencyMap': 'Skill Dependency Graph',
  'nav.uploadGenerate': 'Upload & generate',
  'nav.workforce': 'Workforce',
  'nav.trainingEffectiveness': 'Training effectiveness',
  'nav.auditLog': 'Audit log',
  'nav.myDevelopment': 'My development',
  'nav.trainer': 'Trainer',
  'nav.administration': 'Administration',
  'nav.explore': 'Explore',
  'nav.profile': 'My Profile',
  'nav.signOut': 'Sign out',

  // Common Actions & Buttons
  'action.startLab': 'Start Lab',
  'action.runExperiment': 'Run Experiment',
  'action.backToLabs': 'Back to Virtual Labs',
  'action.checkAnswer': 'Check Answer',
  'action.nextQuestion': 'Next Question',
  'action.reset': 'Reset Data',
  'action.askAi': 'Ask AI for Insights',
  'action.askHint': 'Get AI Hint',
  'action.send': 'Send',
  'action.submit': 'Submit',
  'action.viewProfile': 'View Profile',
  'action.explorePath': 'Explore Learning Path',
  'action.viewGaps': 'View Skill Gaps',

  // Badges & Statuses
  'status.notStarted': 'Not started',
  'status.inProgress': 'In progress',
  'status.completed': 'Completed',
  'status.correct': 'Correct',
  'status.incorrect': 'Incorrect',
  'status.aiEnhanced': 'AI-enhanced explanation',
  'status.builtIn': 'STATINTEL built-in explanation',
  'status.simulated': 'Simulated fallback',
  'difficulty.beginner': 'Beginner',
  'difficulty.intermediate': 'Intermediate',
  'difficulty.advanced': 'Advanced',

  // Virtual Lab Section
  'lab.title': 'Virtual Statistics & Data Lab',
  'lab.subtitle': 'Hands-on interactive laboratory for mastering core statistical concepts and data-driven methods for official statistics.',
  'lab.filterAll': 'All Labs',
  'lab.instructions': 'Instructions & Objective',
  'lab.dataInput': 'Dataset & Controls',
  'lab.results': 'Calculated Results',
  'lab.explanation': 'Conceptual Explanation',
  'lab.practice': 'Practice & Concept Check',
  'lab.questionsAnswered': 'Questions Answered',

  // Chatbot / Learning Assistant
  'chat.title': 'STATINTEL Learning Assistant',
  'chat.subtitle': 'Ask me about your skills, learning path, competencies, or technical topics.',
  'chat.placeholder': 'Type your question here...',
  'chat.quickQuestions': 'Quick questions:',
  'chat.aiPowered': 'AI-Powered',
  'chat.localFallback': 'STATINTEL Knowledge Engine',

  // Future Skills
  'futureSkills.title': 'Predictive Future-Skill Insights',
  'futureSkills.subtitle': 'Data-driven skill trajectories and learning priorities based on your current role, desired transition, and competency gaps.',
  'futureSkills.disclaimer': 'Future-skill insights are pedagogical projections based on MoSPI cadre standards and curriculum roadmaps, not speculative market claims.',
  'futureSkills.priorityAreas': 'Priority Future Skill Areas',
  'futureSkills.growthVectors': 'Competency Growth Vectors',
  'futureSkills.targetRole': 'Target Role Alignment',

  // Recommendations
  'recommendations.title': 'Personalized Learning Recommendations',
  'recommendations.subtitle': 'Curated courses, practical lab exercises, and targeted learning modules mapped directly to your verified competency gaps.',
  'recommendations.topCourses': 'Recommended Catalog Courses',
  'recommendations.recommendedLabs': 'Recommended Hands-on Labs',
  'recommendations.whyRecommended': 'Why this is recommended for you',

  // Assessment & System
  'assessment.title': 'Competency Assessment',
  'assessment.instructions': 'Answer all questions based on official statistical standards and methodology.',
  'assessment.score': 'Score',
  'assessment.feedback': 'Feedback',

  // Language selector
  'lang.select': 'Language',
  'lang.en': 'English',
  'lang.hi': 'हिन्दी (Hindi)',
  'lang.te': 'తెలుగు (Telugu)',
  'lang.bhashiniReady': 'Bhashini-Ready',
};

export type TranslationKey = keyof typeof en;
