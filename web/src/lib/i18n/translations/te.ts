import type { TranslationKey } from './en.js';

export const te: Partial<Record<TranslationKey, string>> = {
  // Common Navigation
  'nav.dashboard': 'డాష్‌బోర్డ్',
  'nav.skillGaps': 'నైపుణ్య లోపాలు',
  'nav.learningPath': 'అభ్యాస మార్గం',
  'nav.assessment': 'సామర్థ్య అంచనా',
  'nav.learningAssistant': 'లెర్నింగ్ అసిస్టెంట్ (AI)',
  'nav.virtualLab': 'వర్చువల్ ల్యాబ్',
  'nav.futureSkills': 'భవిష్యత్తు నైపుణ్యాలు',
  'nav.recommendations': 'వ్యక్తిగత సిఫార్సులు',
  'nav.competencyMap': 'సామర్థ్య పటం',
  'nav.uploadGenerate': 'అప్‌లోడ్ & జనరేట్',
  'nav.workforce': 'సిబ్బంది విశ్లేషణ',
  'nav.trainingEffectiveness': 'శిక్షణ ప్రభావశీలత',
  'nav.auditLog': 'ఆడిట్ లాగ్',
  'nav.myDevelopment': 'నా అభివృద్ధి',
  'nav.trainer': 'శిక్షకుడు',
  'nav.administration': 'పరిపాలన',
  'nav.explore': 'అన్వేషించండి',
  'nav.profile': 'నా ప్రొఫైల్',
  'nav.signOut': 'లాగ్ అవుట్',

  // Common Actions & Buttons
  'action.startLab': 'ల్యాబ్ ప్రారంభించండి',
  'action.runExperiment': 'ప్రయోగం నిర్వహించండి',
  'action.backToLabs': 'వర్చువల్ ల్యాబ్‌లకు తిరిగి వెళ్లండి',
  'action.checkAnswer': 'సమాధానం సరిచూడండి',
  'action.nextQuestion': 'తరువాతి ప్రశ్న',
  'action.reset': 'డేటాను రీసెట్ చేయండి',
  'action.askAi': 'AI వివరణ పొందండి',
  'action.askHint': 'AI సూచన పొందండి',
  'action.send': 'పంపండి',
  'action.submit': 'సమర్పించండి',
  'action.viewProfile': 'ప్రొఫైల్ చూడండి',
  'action.explorePath': 'అభ్యాస మార్గాన్ని చూడండి',
  'action.viewGaps': 'నైపుణ్య లోపాలు చూడండి',

  // Badges & Statuses
  'status.notStarted': 'ప్రారంభించలేదు',
  'status.inProgress': 'పురోగతిలో ఉంది',
  'status.completed': 'పూర్తయింది',
  'status.correct': 'సరైన సమాధానం',
  'status.incorrect': 'తప్పు సమాధానం',
  'status.aiEnhanced': 'AI-మెరుగైన వివరణ',
  'status.builtIn': 'STATINTEL అంతర్నిర్మిత వివరణ',
  'status.simulated': 'సిమ్యులేటెడ్ ఫాల్‌బ్యాక్',
  'difficulty.beginner': 'ప్రారంభ స్థాయి',
  'difficulty.intermediate': 'మధ్యస్థ స్థాయి',
  'difficulty.advanced': 'ఉన్నత స్థాయి',

  // Virtual Lab Section
  'lab.title': 'వర్చువల్ గణాంకాలు & డేటా ల్యాబ్',
  'lab.subtitle': 'అధికారిక గణాంకాల కోసం ప్రాథమిక గణాంక భావనలు మరియు డేటా విశ్లేషణ పద్ధతులను సాధన చేసే ఇంటరాక్టివ్ ల్యాబ్.',
  'lab.filterAll': 'అన్ని ల్యాబ్‌లు',
  'lab.instructions': 'సూచనలు & లక్ష్యం',
  'lab.dataInput': 'డేటాసెట్ & నియంత్రణలు',
  'lab.results': 'గణించబడిన ఫలితాలు',
  'lab.explanation': 'భావనాత్మక వివరణ',
  'lab.practice': 'అభ్యాస ప్రశ్నలు',
  'lab.questionsAnswered': 'సమాధానమిచ్చిన ప్రశ్నలు',

  // Chatbot / Learning Assistant
  'chat.title': 'STATINTEL లెర్నింగ్ అసిస్టెంట్',
  'chat.subtitle': 'మీ నైపుణ్యాలు, అభ్యాస మార్గం, సామర్థ్యాలు లేదా సాంకేతిక అంశాల గురించి నన్ను అడగండి.',
  'chat.placeholder': 'మీ ప్రశ్నను ఇక్కడ టైప్ చేయండి...',
  'chat.quickQuestions': 'శీఘ్ర ప్రశ్నలు:',
  'chat.aiPowered': 'AI-ఆధారితం',
  'chat.localFallback': 'STATINTEL స్థానిక నాలెడ్జ్ ఇంజిన్',

  // Future Skills
  'futureSkills.title': 'భవిష్యత్తు నైపుణ్యాల అంతర్దృష్టులు',
  'futureSkills.subtitle': 'మీ ప్రస్తుత ఉద్యోగ పాత్ర, ఆశించిన మార్పు మరియు నైపుణ్య లోపాల ఆధారంగా రూపొందించిన విశ్లేషణ.',
  'futureSkills.disclaimer': 'భవిష్యత్తు నైపుణ్యాల విశ్లేషణ MoSPI ప్రమాణాల ఆధారంగా రూపొందించిన సూచనలు మాత్రమే.',
  'futureSkills.priorityAreas': 'ప్రాధాన్యత భవిష్యత్తు నైపుణ్య రంగాలు',
  'futureSkills.growthVectors': 'సామర్థ్య వృద్ధి దిశలు',
  'futureSkills.targetRole': 'లక్ష్య ఉద్యోగ పాత్ర',

  // Recommendations
  'recommendations.title': 'వ్యక్తిగతీకరించిన అభ్యాస సిఫార్సులు',
  'recommendations.subtitle': 'మీ ధృవీకరించబడిన నైపుణ్య లోపాలకు అనుగుణంగా రూపొందించిన కోర్సులు మరియు ప్రయోగశాలలు.',
  'recommendations.topCourses': 'సిఫార్సు చేయబడిన కోర్సులు',
  'recommendations.recommendedLabs': 'సిఫార్సు చేయబడిన ప్రాక్టికల్ ల్యాబ్‌లు',
  'recommendations.whyRecommended': 'ఇది మీకు ఎందుకు సిఫార్సు చేయబడింది',

  // Assessment & System
  'assessment.title': 'సామర్థ్య అంచనా',
  'assessment.instructions': 'అధికారిక గణాంక ప్రమాణాల ఆధారంగా అన్ని ప్రశ్నలకు సమాధానాలు ఇవ్వండి.',
  'assessment.score': 'స్కోరు',
  'assessment.feedback': 'అభిప్రాయం',

  // Language selector
  'lang.select': 'భాషను ఎంచుకోండి',
  'lang.en': 'English',
  'lang.hi': 'हिन्दी',
  'lang.te': 'తెలుగు',
  'lang.bhashiniReady': 'భాషిణి-సిద్ధం',
};
