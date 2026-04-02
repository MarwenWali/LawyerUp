"""
Comprehensive testing and evaluation suite for Tunisian Arabic Legal Model
"""

import torch
import json
from transformers import AutoTokenizer, AutoModelForCausalLM
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TunisianModelEvaluator:
    """
    Evaluate the fine-tuned Tunisian Arabic legal model
    """
    
    def __init__(self, model_path: str = "./legal-model"):
        logger.info(f"Loading model from {model_path}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            device_map="auto",
            torch_dtype=torch.float16,
        )
        logger.info("✓ Model loaded!")
    
    def generate_response(self, question: str, max_length: int = 200) -> str:
        """
        Generate response for a given question
        
        Args:
            question: Input question
            max_length: Max tokens to generate
            
        Returns:
            Generated answer
        """
        prompt = f"""### Instruction:
Answer in the same language as the user 

### Question:
{question}

### Answer:"""
        
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_length,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                repetition_penalty=1.2,
            )
        
        full_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        answer = full_text.split("### Answer:")[-1].strip()
        
        return answer
    
    def evaluate_on_test_set(self, test_queries: List[Dict[str, str]]) -> None:
        """
        Evaluate model on test queries
        
        Args:
            test_queries: List of dicts with 'query' and optionally 'expected_keywords'
        """
        logger.info("\n" + "=" * 80)
        logger.info("EVALUATING MODEL ON TEST QUERIES")
        logger.info("=" * 80)
        
        for i, test in enumerate(test_queries, 1):
            query = test['query']
            keywords = test.get('expected_keywords', [])
            
            logger.info(f"\n[Test {i}] Query: {query}")
            logger.info("-" * 80)
            
            answer = self.generate_response(query)
            logger.info(f"Answer: {answer}")
            
            if keywords:
                found_keywords = [k for k in keywords if k.lower() in answer.lower()]
                if found_keywords:
                    logger.info(f"✓ Found keywords: {', '.join(found_keywords)}")
                else:
                    logger.info(f"⚠ No keywords found. Expected: {', '.join(keywords)}")


def interactive_test():
    """Interactive testing mode"""
    evaluator = TunisianModelEvaluator()
    
    logger.info("\n" + "=" * 80)
    logger.info("INTERACTIVE TESTING MODE - Tunisian Arabic Legal Model")
    logger.info("=" * 80)
    logger.info("Ask questions in Darija, French, English, or Arabic - press Ctrl+C to exit\n")
    
    while True:
        try:
            question = input("Ask a question: ")
            if not question.strip():
                continue
            answer = evaluator.generate_response(question)
            print(f"\nAnswer:\n{answer}\n")
        except KeyboardInterrupt:
            logger.info("\nExiting interactive mode...")
            break


def run_comprehensive_tests():
    """Run comprehensive tests on the model"""
    
    # Initialize evaluator
    evaluator = TunisianModelEvaluator()
    
    # Define test queries in different languages/dialects
    test_queries = [
        # Tunisian Arabic (Darija) with transliteration
        {
            'query': 'chnowa 7a9i fil travail fi tounes?',
            'expected_keywords': ['droit', 'travail', 'tounes', 'contrat']
        },
        {
            'query': 'najem na3mel contrat sans avocat?',
            'expected_keywords': ['contrat', 'avocat', 'possible', 'oui']
        },
        
        # Modern Standard Arabic
        {
            'query': 'ما هي حقوقي في العمل؟',
            'expected_keywords': ['حقوق', 'عمل', 'عقد']
        },
        
        # French
        {
            'query': 'Quels sont mes droits du travail?',
            'expected_keywords': ['droits', 'travail', 'contrat']
        },
        
        # English
        {
            'query': 'What is my minimum wage in Tunisia?',
            'expected_keywords': ['wage', 'minimum', 'tunisia', 'salary']
        },
    ]
    
    evaluator.evaluate_on_test_set(test_queries)
    
    logger.info("\n" + "=" * 80)
    logger.info("TESTING COMPLETE")
    logger.info("=" * 80)


def test_tokenizer_coverage():
    """Test that the tokenizer can handle Arabic script"""
    
    logger.info("\n" + "=" * 80)
    logger.info("TESTING TOKENIZER COVERAGE")
    logger.info("=" * 80)
    
    tokenizer = AutoTokenizer.from_pretrained("./legal-model")
    
    test_texts = [
        "chnowa 7a9i fil travail",  # Darija
        "ما هي حقوقي في العمل",  # Arabic
        "Quels sont mes droits",  # French
        "What are my rights",  # English
    ]
    
    for text in test_texts:
        tokens = tokenizer.tokenize(text)
        token_count = len(tokens)
        logger.info(f"Text: {text}")
        logger.info(f"Tokens: {token_count}")
        logger.info(f"Details: {tokens}\n")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--interactive':
        interactive_test()
    else:
        logger.info("Starting Tunisian Legal Model Evaluation")
        run_comprehensive_tests()
        # Uncomment to test tokenizer coverage
        # test_tokenizer_coverage()