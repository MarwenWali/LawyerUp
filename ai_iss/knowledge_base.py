"""
Legal knowledge base - Fallback responses for when model loading fails
Provides real Tunisian labor law information in multiple languages
"""

# Knowledge base of common legal questions and answers
LEGAL_KNOWLEDGE_BASE = {
    "labor_rights_darija": {
        "question_patterns": ["حقوق", "7a9i", "كخدما", "خدمة", "عمل"],
        "answer": """حسب القانون التونسي، لديك حقوق مهمة في العمل:

1. **الحق في الأجر العادل**: يجب أن تتقاضى أجراً معقولاً مقابل عملك
2. **الحق في الراحة**: لك الحق في يوم راحة أسبوعي وإجازات سنوية
3. **الحق في السلامة**: صاحب العمل مسؤول عن سلامتك في العمل
4. **الحق في الكرامة**: لا يحق لأحد أن يسيء معاملتك في العمل
5. **الحق في التدريب**: يجب أن توفر لك فرص للتطور الوظيفي

في حالة انتهاك هذه الحقوق، يمكنك:
- تقديم شكوى رسمية لمفتشية العمل
- الاتصال بنقابة العمل
- اللجوء إلى المحكمة إذا لزم الأمر
"""
    },
    "labor_rights_english": {
        "question_patterns": ["labor", "rights", "work", "employment", "job"],
        "answer": """According to Tunisian law, you have important labor rights:

1. **Right to Fair Wage**: You must receive reasonable compensation for your work
2. **Right to Rest**: You have the right to weekly rest days and annual leave
3. **Right to Safety**: Your employer is responsible for your safety at work
4. **Right to Dignity**: No one can mistreat you at work
5. **Right to Training**: You should have opportunities for professional development

If your rights are violated, you can:
- File a formal complaint with the Labor Inspection Office
- Contact a labor union
- Take legal action if necessary
"""
    },
    "labor_rights_french": {
        "question_patterns": ["droit", "travail", "emploi", "salaire", "congé"],
        "answer": """Selon la loi tunisienne, vous avez d'importants droits du travail:

1. **Droit à un salaire équitable**: Vous devez recevoir une rémunération raisonnable
2. **Droit au repos**: Vous avez droit à un jour de repos hebdomadaire et à des congés annuels
3. **Droit à la sécurité**: L'employeur est responsable de votre sécurité au travail
4. **Droit à la dignité**: Personne ne peut vous maltraiter au travail
5. **Droit à la formation**: Vous devez avoir des opportunités de développement professionnel

Si vos droits sont violés, vous pouvez:
- Déposer une plainte formelle auprès de l'Inspection du travail
- Contacter un syndicat
- Intenter une action en justice si nécessaire
"""
    },
    "labor_rights_msa": {
        "question_patterns": ["حق", "عمل", "توظيف", "راتب", "أجر"],
        "answer": """وفقاً للقانون التونسي، لديك حقوق عمل مهمة:

1. **الحق في الأجر العادل**: يجب أن تتقاضى أجراً معقولاً مقابل عملك
2. **الحق في الراحة**: لك الحق في يوم راحة أسبوعي وإجازات سنوية
3. **الحق في السلامة**: يتحمل صاحب العمل مسؤولية سلامتك في العمل
4. **الحق في الكرامة**: لا يحق لأحد أن يسيء معاملتك في العمل
5. **الحق في التدريب**: يجب أن تتاح لك فرص للتطور الوظيفي

إذا انتهكت حقوقك، يمكنك:
- تقديم شكوى رسمية لمفتشية العمل
- التواصل مع نقابة عمالية
- اللجوء إلى القضاء إذا لزم الأمر
"""
    }
}

def get_fallback_response(question: str, language: str = "auto") -> str:
    """
    Get a response from knowledge base when model loading fails
    
    Args:
        question: User's legal question
        language: auto, english, darija, french, msa
        
    Returns:
        Legal information response
    """
    question_lower = question.lower()
    
    # Auto-detect language
    if language == "auto":
        if any(char in question for char in "ءأؤإئبةتثجحخدذرزسشصضطظعغفقكلمنهويَُِّْ"):
            language = "msa"  # Arabic characters detected
        elif any(char in question for char in "ç"):
            language = "french"
        else:
            language = "english"
    
    # Check for labor/rights keywords
    labor_keywords = ["حق", "labor", "droit", "work", "travail", "عمل", "emploi", "7a9i", "خدمة"]
    
    if any(keyword in question_lower for keyword in labor_keywords):
        if language == "french":
            return LEGAL_KNOWLEDGE_BASE["labor_rights_french"]["answer"]
        elif language == "msa":
            return LEGAL_KNOWLEDGE_BASE["labor_rights_msa"]["answer"]
        elif language == "english":
            return LEGAL_KNOWLEDGE_BASE["labor_rights_english"]["answer"]
        else:
            return LEGAL_KNOWLEDGE_BASE["labor_rights_darija"]["answer"]
    
    # Default response for non-legal questions
    if language == "french":
        return "Je peux vous aider avec des questions juridiques tunisiennes. Veuillez me poser une question sur vos droits du travail, vos droits en tant que consommateur, ou d'autres questions juridiques."
    elif language == "msa":
        return "يمكنني مساعدتك مع الأسئلة القانونية التونسية. يرجى طرح سؤال حول حقوقك في العمل أو حقوقك كمستهلك أو أي أسئلة قانونية أخرى."
    elif language == "english":
        return "I can help you with Tunisian legal questions. Please ask about your labor rights, consumer rights, or other legal matters."
    else:
        return "نجم نعاونك في حاجة قانونية. اسأل عن حقوقك في العمل أو حقوقك كمستهلك أو حاجات قانونية أخرى."
