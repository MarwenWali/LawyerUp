import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LanguageContext = createContext();

const translations = {
  en: {
    chat: 'Ask the Tunisian Law AI',
    contactLawyer: 'Contact a Lawyer',
    profile: 'Profile',
    signInSignUp: 'Sign In / Sign Up',
    disclaimer: 'Disclaimer',
    disclaimer_text: 'This app provides AI-generated legal information. It is not a substitute for professional legal advice. The AI may make mistakes.',
    accept: 'I understand and accept',
    ask_question: 'Ask a question or paste a document...',
    send: 'Send',
    filter: 'Filter',
    lawyers: 'Lawyers',
    backToLawyers: 'Back to Lawyers',
    logout: 'Log Out',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    bio: 'Bio',
    save: 'Save',
    fees: 'Fees',
    rating: 'Rating',
    specialization: 'Specialization',
    experience: 'Experience',
    signed_in: 'Signed in as',
    prompts_used: 'Free prompts used',
    free_prompts_exhausted: 'Free prompts exhausted. Come back in',
  },
  fr: {
    chat: 'Demander à l\'IA sur le droit tunisien',
    contactLawyer: 'Contacter un Avocat',
    profile: 'Profil',
    signInSignUp: 'Se Connecter / S\'Inscrire',
    disclaimer: 'Avertissement',
    disclaimer_text: 'Cette application fournit des informations juridiques générées par l\'IA. Ce n\'est pas un substitut aux conseils juridiques professionnels. L\'IA peut faire des erreurs.',
    accept: 'Je comprends et j\'accepte',
    ask_question: 'Posez une question ou collez un document...',
    send: 'Envoyer',
    filter: 'Filtrer',
    lawyers: 'Avocats',
    backToLawyers: 'Retour aux avocats',
    logout: 'Se Déconnecter',
    name: 'Nom',
    email: 'Email',
    phone: 'Téléphone',
    bio: 'Biographie',
    save: 'Enregistrer',
    fees: 'Honoraires',
    rating: 'Notation',
    specialization: 'Spécialisation',
    experience: 'Expérience',
    signed_in: 'Connecté en tant que',
    prompts_used: 'Invites gratuites utilisées',
    free_prompts_exhausted: 'Les invites gratuites sont épuisées. Revenez dans',
  },
  ar: {
    chat: 'اسأل ذكاء القانون التونسي',
    contactLawyer: 'التواصل مع محام',
    profile: 'الملف الشخصي',
    signInSignUp: 'تسجيل الدخول / إنشاء حساب',
    disclaimer: 'تحذير',
    disclaimer_text: 'توفر هذه التطبيق معلومات قانونية يتم إنشاؤها بواسطة الذكاء الاصطناعي. لا تحل محل الاستشارات القانونية المهنية. قد تحتوي على أخطاء.',
    accept: 'أفهم وأوافق',
    ask_question: 'اسأل سؤالاً أو الصق مستندًا...',
    send: 'إرسال',
    filter: 'تصفية',
    lawyers: 'المحامون',
    backToLawyers: 'العودة للمحامين',
    logout: 'تسجيل الخروج',
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    bio: 'السيرة الذاتية',
    save: 'حفظ',
    fees: 'الأتعاب',
    rating: 'التقييم',
    specialization: 'التخصص',
    experience: 'الخبرة',
    signed_in: 'تسجيل الدخول باسم',
    prompts_used: 'الطلبات المجانية المستخدمة',
    free_prompts_exhausted: 'تم استنفاد الطلبات المجانية. العودة في',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('language');
        if (saved) setLanguage(saved);
      } catch (e) {
        console.warn(e);
      }
    })();
  }, []);

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    await AsyncStorage.setItem('language', lang);
  };

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageProvider;
