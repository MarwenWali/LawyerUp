# Tunisian Slang Converter - converts formal responses to Tunisian dialect and understands slang input

# SLANG TO FORMAL (INPUT UNDERSTANDING)
SLANG_TO_FORMAL = {
    # Tunisian Slang to Formal Arabic - for understanding user input
    "بزاف": "كثيرا",
    "بزيادة": "كثيرا",
    "والو": "لا شيء",
    "تمام": "حسناً",
    "تمام التمام": "حسناً جداً",
    "عادي": "عادي",
    "فاهم": "أفهم",
    "فاهمني": "تفهمني",
    "والاّ": "أو",
    "خاطرك": "لأن",
    "يفتك": "يجب عليك",
    "مشّا بك": "دعنا نذهب",
    "الله يرحم": "يرحمه الله",
    "خسّ": "عار",
    "كيفك": "كيف حالك",
    "حنين": "حنين",
    "قلبي": "يا قلبي",
    "ونيسة": "ليلة جميلة",
    "معا": "مع",
    "إنّ": "إن",
    "الّ": "الذي",
    "اللي": "الذي",
    "ديالي": "الخاص بي",
    "ديالك": "الخاص بك",
    "ديالو": "الخاص به",
    "ديالها": "الخاص بها",
    "ديالنا": "الخاص بنا",
    "ديالكم": "الخاص بكم",
    "ديالهم": "الخاص بهم",
    "نـــجم": "أستطيع",
    "نقول": "أقول",
    "نعاونك": "أساعدك",
    "يقول": "يقول",
    "حاجة": "شيء",
    "مشكلة": "مشكلة",
    "ما فيش": "لا يوجد",
    "ما فمّة": "لا يوجد",
    "خدام": "موظف",
    "خدمة": "عمل",
    "راتب": "أجر",
    "فلوس": "أموال",
    "بنكة": "بنك",
    "كرهبة": "سيارة",
    "جلسة": "اجتماع",
    "ملتوم": "عقد",
    "ملتوما": "عقد",
    "صاحب": "مالك",
    "ولي": "مالك",
    "قاضي": "قاضي",
    "محامي": "محامي",
    "عدل": "عدل",
    "حق": "حق",
    "قانون": "قانون",
    "حكم": "حكم",
    "محكمة": "محكمة",
    "دعوة": "قضية",
    "دعية": "قضية",
    "سنة": "سنة",
    "شهر": "شهر",
    "يوم": "يوم",
    "ساعة": "ساعة",
    "وقت": "وقت",
    "وقتاش": "متى",
    "فين": "أين",
    "هاهنا": "هنا",
    "هاهنة": "هنا",
    "هنيّ": "هناك",
    "كيما": "مثل",
    "مثل": "مثل",
    "كيف": "كيف",
    "آش": "ماذا",
    "واش": "ماذا",
    "منين": "من أين",
    "علاش": "لماذا",
    "شنو": "ماذا",
    "شنية": "ماذا",
    "ولّا": "أو",
    "إمّا": "إما",
    "لكن": "لكن",
    "ولكن": "لكن",
    "ماكش": "ليس هناك",
    "ما كانش": "لم يكن",
    "كان": "كان",
    "كانت": "كانت",
    "أنا": "أنا",
    "انت": "أنت",
    "وتى": "أنت",
    "هو": "هو",
    "هي": "هي",
    "احنا": "نحن",
    "انتوا": "أنتم",
    "هوما": "هم",
    "هنّ": "هن",
}

# FORMAL TO SLANG (OUTPUT GENERATION)
SLANG_REPLACEMENTS = {
    # Formal to Slang conversions
    "السلام عليكم": "السلام عليكم و رحمة الله",
    "شكراً": "شكرا بزاف",
    "من فضلك": "من فضلك بزاف",
    "لا": "لا لا",
    "نعم": "آه بزاف",
    "ممكن": "نجم",
    "يجب عليك": "يفتك",
    "يجب": "يفتك",
    "ليس": "ما فيش",
    "النقابة": "الاتحاد",
    "العقد": "الملتوم",
    "الأجر": "الراتب أو الفلوس",
    "الموظف": "الخدام",
    "البنك": "البنكة",
    "التأمين": "الراحة",
    "الضريبة": "الخرج",
    "الحكومة": "الدولة",
    "القاضي": "القاضي",
    "المحامي": "المحامي",
    "العدالة": "الحق",
    "الحق": "الحق ديالي",
    "القانون": "القانون",
    "إذا": "إذا",
    "لأن": "لأن",
    "لكن": "لكن",
    "و": "و",
    "هذا": "هاذا",
    "ذلك": "ذالك",
    "الذي": "اللي",
    "التي": "اللي",
    "ما": "ما",
    "كان": "كان",
    "كانت": "كانت",
    "على": "على",
    "في": "فيها",
    "من": "من",
    "إلى": "إلى",
    "عن": "عن",
    "الإجراء": "الطريقة",
    "المطلوب": "اللي تحتاج",
    "يتوجب": "يفتك",
    "يتعين": "يفتك",
    "بالإضافة إلى": "بزيادة على",
    "فضلاً عن": "بزيادة على",
    "علاوة على": "بزيادة على",
    "غالباً": "درجة أولى",
    "عادة": "بصفة عادية",
    "بشكل عام": "بشكل عام",
    "كقاعدة عامة": "بصفة عامة",
}

SLANG_SUFFIXES = {
    "ة": "ة",  # Keep ة
    "ها": "ها",  # possessive
}

def convert_to_slang(text):
    """
    Convert formal Arabic text to Tunisian slang
    """
    if not text:
        return text
    
    # Convert formal phrases to slang
    result = text
    for formal, slang in SLANG_REPLACEMENTS.items():
        result = result.replace(formal, slang)
    
    # Add Tunisian slang particles
    lines = result.split(".")
    slang_lines = []
    
    for line in lines:
        line = line.strip()
        if line:
            # Add common Tunisian slang particles
            if not any(particle in line for particle in ["بزاف", "والو", "تمام", "عادي", "فاهم", "ولاّ"]):
                # Randomly add some personality to certain lines
                if "يفتك" in line or "يجب" in line:
                    line += " بزاف"  # "a lot/very much"
                elif any(word in line for word in ["القانون", "العقد", "الحق"]):
                    line += " تمام"  # "okay/fine"
            slang_lines.append(line)
    
    slang_text = ". ".join(slang_lines)
    
    # Fix spacing
    slang_text = slang_text.replace("  ", " ").strip()
    
    return slang_text


def add_tunisian_flavor(text):
    """
    Add Tunisian expressions and slang flavor to the response
    """
    if not text:
        return text
    
    # Common Tunisian expressions
    tunisian_expressions = [
        "والو - nothing",
        "بزاف - very much / a lot",
        "تمام التمام - all good / perfect",
        "عادي - normal / casual",
        " فاهمني - understand me?",
        "والاّ - or",
        "خاطرك - because",
        "يفتك - you should",
        "مشّا بك - let's go",
        "الله يرحم - may God have mercy",
        "خسّ - shame",
        "كيفك؟ - how are you?",
        "حنين - tenderness",
        "قلبي - my heart",
    ]
    
    return convert_to_slang(text)


def understand_slang_input(text):
    """
    Convert Tunisian slang input to formal Arabic so the model understands it
    This helps the model process slang questions better
    """
    if not text:
        return text
    
    result = text
    
    # Convert slang words to formal Arabic (case-insensitive)
    for slang_word, formal_word in SLANG_TO_FORMAL.items():
        # Use word boundaries to avoid partial matches
        # Simple replacement - can be improved with regex
        result = result.replace(slang_word, formal_word)
        result = result.replace(slang_word.capitalize(), formal_word)
    
    return result
