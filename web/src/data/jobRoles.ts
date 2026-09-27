export interface JobRoleItem {
  id: string;
  title: string;
  category: string;
}

export const JOB_ROLE_CATALOG: JobRoleItem[] = [
  // DATA & ANALYTICS
  { id: 'data-analyst', title: 'Data Analyst', category: 'Data & Analytics' },
  { id: 'data-scientist', title: 'Data Scientist', category: 'Data & Analytics' },
  { id: 'data-engineer', title: 'Data Engineer', category: 'Data & Analytics' },
  { id: 'bi-analyst', title: 'BI Analyst', category: 'Data & Analytics' },
  { id: 'bi-developer', title: 'BI Developer', category: 'Data & Analytics' },
  { id: 'ml-engineer', title: 'Machine Learning Engineer', category: 'Data & Analytics' },
  { id: 'ai-engineer', title: 'AI Engineer', category: 'Data & Analytics' },
  { id: 'statistician', title: 'Statistician', category: 'Data & Analytics' },
  { id: 'statistical-officer', title: 'Statistical Officer', category: 'Data & Analytics' },
  { id: 'research-analyst', title: 'Research Analyst', category: 'Data & Analytics' },
  { id: 'data-quality-analyst', title: 'Data Quality Analyst', category: 'Data & Analytics' },
  { id: 'quantitative-analyst', title: 'Quantitative Analyst', category: 'Data & Analytics' },
  { id: 'database-admin', title: 'Database Administrator', category: 'Data & Analytics' },

  // SOFTWARE & TECHNOLOGY
  { id: 'software-engineer', title: 'Software Engineer', category: 'Software & Technology' },
  { id: 'frontend-dev', title: 'Frontend Developer', category: 'Software & Technology' },
  { id: 'backend-dev', title: 'Backend Developer', category: 'Software & Technology' },
  { id: 'fullstack-dev', title: 'Full Stack Developer', category: 'Software & Technology' },
  { id: 'mobile-app-dev', title: 'Mobile App Developer', category: 'Software & Technology' },
  { id: 'web-dev', title: 'Web Developer', category: 'Software & Technology' },
  { id: 'devops-engineer', title: 'DevOps Engineer', category: 'Software & Technology' },
  { id: 'cloud-engineer', title: 'Cloud Engineer', category: 'Software & Technology' },
  { id: 'cybersecurity-analyst', title: 'Cybersecurity Analyst', category: 'Software & Technology' },
  { id: 'system-admin', title: 'System Administrator', category: 'Software & Technology' },
  { id: 'qa-engineer', title: 'QA Engineer', category: 'Software & Technology' },
  { id: 'software-tester', title: 'Software Tester', category: 'Software & Technology' },
  { id: 'solutions-architect', title: 'Solutions Architect', category: 'Software & Technology' },

  // MANAGEMENT & BUSINESS
  { id: 'business-analyst', title: 'Business Analyst', category: 'Management & Business' },
  { id: 'project-manager', title: 'Project Manager', category: 'Management & Business' },
  { id: 'product-manager', title: 'Product Manager', category: 'Management & Business' },
  { id: 'operations-manager', title: 'Operations Manager', category: 'Management & Business' },
  { id: 'program-manager', title: 'Program Manager', category: 'Management & Business' },
  { id: 'management-consultant', title: 'Management Consultant', category: 'Management & Business' },
  { id: 'bi-manager', title: 'Business Intelligence Manager', category: 'Management & Business' },

  // STATISTICS & GOVERNMENT
  { id: 'senior-statistical-officer', title: 'Senior Statistical Officer', category: 'Statistics & Government' },
  { id: 'junior-statistical-officer', title: 'Junior Statistical Officer', category: 'Statistics & Government' },
  { id: 'assistant-statistical-officer', title: 'Assistant Statistical Officer', category: 'Statistics & Government' },
  { id: 'research-officer', title: 'Research Officer', category: 'Statistics & Government' },
  { id: 'economist', title: 'Economist', category: 'Statistics & Government' },
  { id: 'policy-analyst', title: 'Policy Analyst', category: 'Statistics & Government' },
  { id: 'government-analyst', title: 'Government Analyst', category: 'Statistics & Government' },
  { id: 'survey-specialist', title: 'Survey Specialist', category: 'Statistics & Government' },
  { id: 'official-statistics-specialist', title: 'Official Statistics Specialist', category: 'Statistics & Government' },

  // EDUCATION & TRAINING
  { id: 'teacher', title: 'Teacher', category: 'Education & Training' },
  { id: 'lecturer', title: 'Lecturer', category: 'Education & Training' },
  { id: 'trainer', title: 'Trainer', category: 'Education & Training' },
  { id: 'faculty', title: 'Faculty', category: 'Education & Training' },
  { id: 'instructional-designer', title: 'Instructional Designer', category: 'Education & Training' },
  { id: 'training-coordinator', title: 'Training Coordinator', category: 'Education & Training' },

  // FINANCE
  { id: 'financial-analyst', title: 'Financial Analyst', category: 'Finance' },
  { id: 'accountant', title: 'Accountant', category: 'Finance' },
  { id: 'auditor', title: 'Auditor', category: 'Finance' },
  { id: 'risk-analyst', title: 'Risk Analyst', category: 'Finance' },
  { id: 'banking-analyst', title: 'Banking Analyst', category: 'Finance' },

  // ENGINEERING
  { id: 'civil-engineer', title: 'Civil Engineer', category: 'Engineering' },
  { id: 'mechanical-engineer', title: 'Mechanical Engineer', category: 'Engineering' },
  { id: 'electrical-engineer', title: 'Electrical Engineer', category: 'Engineering' },
  { id: 'electronics-engineer', title: 'Electronics Engineer', category: 'Engineering' },
  { id: 'computer-engineer', title: 'Computer Engineer', category: 'Engineering' },
  { id: 'industrial-engineer', title: 'Industrial Engineer', category: 'Engineering' },
];

export const COMMON_SKILLS = [
  'Python',
  'C',
  'C++',
  'Java',
  'JavaScript',
  'HTML',
  'CSS',
  'SQL',
  'React',
  'Node.js',
  'Git',
  'Data Analysis',
  'Machine Learning',
  'Statistics',
  'Excel',
  'R Programming',
  'Docker',
  'Cloud (AWS/GCP/Azure)',
  'Data Visualization',
  'Project Management',
];
