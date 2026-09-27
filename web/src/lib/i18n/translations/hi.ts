import type { TranslationKey } from './en.js';

export const hi: Partial<Record<TranslationKey, string>> = {
  // Common Navigation
  'nav.dashboard': 'डैशबोर्ड',
  'nav.skillGaps': 'कौशल अंतराल',
  'nav.learningPath': 'अध्ययन पथ',
  'nav.assessment': 'क्षमता मूल्यांकन',
  'nav.learningAssistant': 'शिक्षण सहायक (AI)',
  'nav.virtualLab': 'वर्चुअल लैब',
  'nav.futureSkills': 'भविष्य के कौशल',
  'nav.recommendations': 'व्यक्तिगत सिफारिशें',
  'nav.competencyMap': 'दक्षता मानचित्र',
  'nav.uploadGenerate': 'अपलोड और निर्माण',
  'nav.workforce': 'कार्यबल विश्लेषण',
  'nav.trainingEffectiveness': 'प्रशिक्षण प्रभावशीलता',
  'nav.auditLog': 'ऑडिट लॉग',
  'nav.myDevelopment': 'मेरा विकास',
  'nav.trainer': 'प्रशिक्षक',
  'nav.administration': 'प्रशासन',
  'nav.explore': 'अन्वेषण करें',
  'nav.profile': 'मेरी प्रोफ़ाइल',
  'nav.signOut': 'साइन आउट',

  // Common Actions & Buttons
  'action.startLab': 'प्रयोग शुरू करें',
  'action.runExperiment': 'प्रयोग चलाएं',
  'action.backToLabs': 'वर्चुअल लैब पर वापस जाएं',
  'action.checkAnswer': 'उत्तर जांचें',
  'action.nextQuestion': 'अगला प्रश्न',
  'action.reset': 'डेटा रीसेट करें',
  'action.askAi': 'AI व्याख्या प्राप्त करें',
  'action.askHint': 'AI संकेत लें',
  'action.send': 'संदेश भेजें',
  'action.submit': 'जमा करें',
  'action.viewProfile': 'प्रोफ़ाइल देखें',
  'action.explorePath': 'अध्ययन पथ देखें',
  'action.viewGaps': 'कौशल अंतराल देखें',

  // Badges & Statuses
  'status.notStarted': 'शुरू नहीं हुआ',
  'status.inProgress': 'प्रगति पर है',
  'status.completed': 'पूर्ण हुआ',
  'status.correct': 'सही उत्तर',
  'status.incorrect': 'गलत उत्तर',
  'status.aiEnhanced': 'एआई-संवर्धित व्याख्या',
  'status.builtIn': 'STATINTEL अंतर्निहित व्याख्या',
  'status.simulated': 'सिम्युलेटेड फ़ॉलबैक',
  'difficulty.beginner': 'प्रारंभिक',
  'difficulty.intermediate': 'मध्यम',
  'difficulty.advanced': 'उन्नत',

  // Virtual Lab Section
  'lab.title': 'वर्चुअल सांख्यिकी एवं डेटा लैब',
  'lab.subtitle': 'आधिकारिक सांख्यिकी के लिए व्यावहारिक सांख्यिकीय अवधारणाओं और डेटा विश्लेषण तकनीकों का इंटरैक्टिव प्रयोगशाला।',
  'lab.filterAll': 'सभी प्रयोगशालाएं',
  'lab.instructions': 'निर्देश और उद्देश्य',
  'lab.dataInput': 'डेटासेट एवं नियंत्रण',
  'lab.results': 'गणना परिणाम',
  'lab.explanation': 'संकल्पनात्मक व्याख्या',
  'lab.practice': 'अभ्यास प्रश्न एवं जांच',
  'lab.questionsAnswered': 'हल किए गए प्रश्न',

  // Chatbot / Learning Assistant
  'chat.title': 'STATINTEL शिक्षण सहायक',
  'chat.subtitle': 'मुझसे अपने कौशल, अध्ययन पथ, दक्षताओं या तकनीकी विषयों के बारे में पूछें।',
  'chat.placeholder': 'अपना प्रश्न यहां लिखें...',
  'chat.quickQuestions': 'त्वरित प्रश्न:',
  'chat.aiPowered': 'एआई-संचालित',
  'chat.localFallback': 'STATINTEL स्थानीय ज्ञान इंजन',

  // Future Skills
  'futureSkills.title': 'भविष्य-कौशल अंतर्दृष्टि एवं विश्लेषण',
  'futureSkills.subtitle': 'आपकी वर्तमान भूमिका, इच्छित पद और दक्षता अंतराल के आधार पर भविष्य के कौशल मार्ग और प्राथमिकताएं।',
  'futureSkills.disclaimer': 'भविष्य के कौशल अंतर्दृष्टि आधिकारिक सांख्यिकी संवर्ग मानकों पर आधारित शैक्षणिक अनुमान हैं, कोई सट्टा दावा नहीं।',
  'futureSkills.priorityAreas': 'प्राथमिकता भविष्य कौशल क्षेत्र',
  'futureSkills.growthVectors': 'दक्षता विकास दिशाएं',
  'futureSkills.targetRole': 'लक्षित भूमिका संरेखण',

  // Recommendations
  'recommendations.title': 'व्यक्तिगत शिक्षण सिफारिशें',
  'recommendations.subtitle': 'आपके सत्यापित कौशल अंतरालों से जुड़े पाठ्यक्रम, व्यावहारिक प्रयोगशालाएं और लक्षित मॉड्यूल।',
  'recommendations.topCourses': 'अनुशंसित कैटलॉग पाठ्यक्रम',
  'recommendations.recommendedLabs': 'अनुशंसित व्यावहारिक प्रयोगशालाएं',
  'recommendations.whyRecommended': 'यह आपके लिए क्यों अनुशंसित है',

  // Assessment & System
  'assessment.title': 'दक्षता मूल्यांकन',
  'assessment.instructions': 'आधिकारिक सांख्यिकीय मानकों और पद्धतियों के आधार पर सभी प्रश्नों के उत्तर दें।',
  'assessment.score': 'स्कोर',
  'assessment.feedback': 'प्रतिक्रिया',

  // Language selector
  'lang.select': 'भाषा चुनें',
  'lang.en': 'English',
  'lang.hi': 'हिन्दी',
  'lang.te': 'తెలుగు',
  'lang.bhashiniReady': 'भाषिणी-तैयार',
};
