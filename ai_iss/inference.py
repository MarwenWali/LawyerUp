"""
Inference script for Tunisian Arabic Legal Model
Load and test the fine-tuned model on Tunisian Arabic queries
"""

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TunisianArabicLegalAgent:
    """
    Agent for answering Tunisian labor law questions in Arabic/Darija
    """
    
    def __init__(self, model_path: str = "./legal-model", device: int = 0):
        """
        Initialize the legal assistant
        
        Args:
            model_path: Path to fine-tuned model
            device: GPU device index (-1 for CPU, 0+ for GPU)
        """
        self.device = device
        self.model_path = model_path
        
        logger.info(f"Loading model from {model_path}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            device_map="auto" if device >= 0 else "cpu",
            torch_dtype=torch.float16 if device >= 0 else torch.float32,
        )
        
        # Setup generation pipeline
        self.pipe = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
            device=device,
            temperature=0.7,
            top_p=0.9,
            repetition_penalty=1.2,
        )
        
        logger.info("✓ Model loaded successfully!")
    
    def answer(self, question: str, language: str = "auto", max_length: int = 256) -> str:
        """
        Answer a question about Tunisian labor law
        
        Args:
            question: Question in Tunisian Arabic, Modern Standard Arabic, French, or English
            language: "auto" for automatic, "darija", "msa", "french", "english"
            max_length: Maximum response length
            
        Returns:
            Answer to the question
        """
        # Format prompt
        prompt = f"""### Instruction:
Answer in the same language as the user

### Question:
{question}

### Answer:"""
        
        # Generate response
        logger.info(f"Generating response for: {question[:50]}...")
        response = self.pipe(
            prompt,
            max_new_tokens=max_length,
            do_sample=True,
            top_k=50,
        )
        
        # Extract generated text
        full_text = response[0]["generated_text"]
        answer = full_text.split("### Answer:")[-1].strip()
        
        return answer
    
    def batch_answer(self, questions: list) -> list:
        """
        Answer multiple questions in batch
        
        Args:
            questions: List of questions
            
        Returns:
            List of answers
        """
        answers = []
        for q in questions:
            answers.append(self.answer(q))
        return answers


def test_model():
    """Test the fine-tuned model on sample Tunisian Arabic queries"""
    
    # Initialize agent
    agent = TunisianArabicLegalAgent(model_path="./legal-model")
    
    # Test queries in different Arabic variants
    test_queries = [
        # Tunisian Arabic (Darija) with transliteration
        "chnowa 7a9i fil travail fi tounes?",  # What are my labor rights in Tunisia?
        "najem na3mel contrat travail sans avocat?",  # Can I make a labor contract without a lawyer?
        
        # Modern Standard Arabic
        "ما هي حقوقي في العمل في تونس؟",  # What are my labor rights in Tunisia?
        
        # French
        "Quels sont mes droits du travail en Tunisie?",  # What are my labor rights in Tunisia?
        
        # English
        "What is the minimum wage in Tunisia?",
    ]
    
    logger.info("\n" + "=" * 80)
    logger.info("TUNISIAN ARABIC LEGAL ASSISTANT TEST")
    logger.info("=" * 80)
    
    for i, query in enumerate(test_queries, 1):
        logger.info(f"\nQuery {i}: {query}")
        logger.info("-" * 80)
        answer = agent.answer(query)
        logger.info(f"Answer: {answer}\n")


if __name__ == "__main__":
    test_model()
