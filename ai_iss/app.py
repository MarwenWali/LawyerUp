"""
Tunisian Arabic Legal Assistant - Interactive CLI
Fine-tuned for understanding Tunisian Arabic (Darija), French, and Arabic
"""

from router import handle_request
import sys
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _normalize_response_text(text: str) -> str:
    """Collapse accidental immediate duplicates in response text."""
    if not text:
        return text

    def collapse_line(line: str) -> str:
        stripped = line.strip()
        if not stripped:
            return line

        # Handle exact doubled line content: "X.X." -> "X."
        doubled_match = re.fullmatch(r"(.+)\1", stripped)
        if doubled_match:
            return doubled_match.group(1).strip()

        return line

    lines = [collapse_line(line) for line in text.splitlines()]

    # Remove adjacent duplicate lines.
    deduped = []
    for line in lines:
        if deduped and line.strip() and line.strip() == deduped[-1].strip():
            continue
        deduped.append(line)

    return "\n".join(deduped).strip()

def main():
    print("\n" + "=" * 70)
    print("🇹🇳 مرحبا! - تطبيق مساعد القانون التونسي الذكي")
    print("🇹🇳 Tunisian Legal AI Assistant")
    print("=" * 70)
    print("\n📝 اسأل عن حقوقك في العمل في تونس")
    print("📝 Ask about your labor rights in Tunisia")
    print("📝 Demandez vos droits du travail en Tunisie")
    print("\n💬 Supported Languages:")
    print("   • Darija (Tunisian Arabic): chnowa 7a9i fil travail?")
    print("   • Modern Standard Arabic: ما هي حقوقي في العمل؟")
    print("   • French: Quels sont mes droits du travail?")
    print("   • English: What are my labor rights?")
    print("\n⌨️  Type 'quit' or 'exit' to end the conversation")
    print("=" * 70 + "\n")
    
    while True:
        try:
            # Get user input
            user_input = input("أنت / You: ").strip()
            
            if not user_input:
                continue
            
            # Check for exit commands
            if user_input.lower() in ['quit', 'exit', 'خروج', 'خرج']:
                print("\n👋 شكراً و وداعاً! / Thank you and goodbye!")
                break
            
            # Process request
            logger.info(f"Processing query: {user_input[:50]}...")
            response = handle_request(user_input)
            response = _normalize_response_text(response)
            
            print(f"\n🤖 المساعد / Assistant:\n{response}\n")
            
        except KeyboardInterrupt:
            print("\n\n👋 Interrupted. Goodbye!")
            sys.exit(0)
        except Exception as e:
            logger.error(f"Error: {e}")
            print(f"❌ حدث خطأ / An error occurred: {str(e)}\n")

if __name__ == "__main__":
    main()
