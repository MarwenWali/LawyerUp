"""
Data utilities and analysis tools for Tunisian Arabic legal dataset
"""

import json
from pathlib import Path
from typing import Dict, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def analyze_dataset(data_path: str = "data/tunisian_legal.json") -> Dict:
    """
    Analyze the Tunisian Arabic legal dataset
    
    Args:
        data_path: Path to the JSON dataset
        
    Returns:
        Dictionary with dataset statistics
    """
    logger.info(f"Analyzing dataset: {data_path}")
    
    # Load data
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle both list and dict formats
    if isinstance(data, dict):
        examples = data.get('train', [])
    else:
        examples = data
    
    logger.info(f"Total examples: {len(examples)}")
    
    # Analyze languages
    languages = {
        'darija': 0,  # Tunisian Arabic transliteration (contains numbers)
        'msa': 0,  # Modern Standard Arabic (contains Arabic script)
        'french': 0,  # French
        'english': 0,  # English
        'mixed': 0
    }
    
    total_input_length = 0
    total_output_length = 0
    
    for example in examples:
        input_text = example.get('input', '')
        output_text = example.get('output', '')
        
        # Detect language
        has_arabic = any(ord(c) in range(0x0600, 0x06FF) for c in input_text)
        has_french = any(c in 'àâäæçéèêëïîôöœùûüœÿÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŒŸ' for c in input_text)
        has_numbers = any(c.isdigit() for c in input_text)
        has_7 = '7' in input_text or '3' in input_text  # Common in Darija
        
        lang_detected = False
        if has_arabic and not has_french and not has_numbers:
            languages['msa'] += 1
            lang_detected = True
        if has_numbers or has_7 or ('7a' in input_text or 'h3' in input_text):
            languages['darija'] += 1
            lang_detected = True
        if has_french and has_arabic:
            languages['mixed'] += 1
            lang_detected = True
        elif has_french:
            languages['french'] += 1
            lang_detected = True
        if not lang_detected and all(ord(c) < 128 for c in input_text):
            languages['english'] += 1
        
        total_input_length += len(input_text)
        total_output_length += len(output_text)
    
    stats = {
        'total_examples': len(examples),
        'languages': languages,
        'avg_input_length': total_input_length / len(examples) if examples else 0,
        'avg_output_length': total_output_length / len(examples) if examples else 0,
        'total_tokens_approx': (total_input_length + total_output_length) * 1.3,  # Rough estimate
    }
    
    logger.info("\n" + "=" * 60)
    logger.info("DATASET ANALYSIS")
    logger.info("=" * 60)
    logger.info(f"Total examples: {stats['total_examples']}")
    logger.info(f"Average input length: {stats['avg_input_length']:.1f} chars")
    logger.info(f"Average output length: {stats['avg_output_length']:.1f} chars")
    logger.info("\nLanguage distribution:")
    for lang, count in stats['languages'].items():
        if count > 0:
            pct = (count / len(examples)) * 100
            logger.info(f"  {lang}: {count} ({pct:.1f}%)")
    logger.info(f"\nApprox total tokens: {stats['total_tokens_approx']:,.0f}")
    logger.info("=" * 60 + "\n")
    
    return stats


def validate_dataset(data_path: str = "data/tunisian_legal.json") -> bool:
    """
    Validate that the dataset has correct format
    
    Returns:
        True if valid, False otherwise
    """
    logger.info(f"Validating dataset: {data_path}")
    
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Check if it's a list or dict
        if isinstance(data, dict):
            examples = data.get('train', [])
        else:
            examples = data
        
        if not examples:
            logger.error("Dataset is empty!")
            return False
        
        # Check each example
        for i, example in enumerate(examples):
            if not isinstance(example, dict):
                logger.error(f"Example {i} is not a dict")
                return False
            
            if 'input' not in example or 'output' not in example:
                logger.error(f"Example {i} missing 'input' or 'output' key")
                return False
        
        logger.info(f"✓ Dataset valid! {len(examples)} examples")
        return True
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return False
    except Exception as e:
        logger.error(f"Validation error: {e}")
        return False


def augment_with_darija_aliases(input_text: str) -> List[str]:
    """
    Generate alternative Darija/Arabic representations of a query
    Useful for data augmentation
    
    Args:
        input_text: Original query text
        
    Returns:
        List of alternative formulations
    """
    
    # Common Darija → formal Arabic mappings
    darija_to_msa = {
        'chnowa': 'ما هي',
        'najem': 'هل يمكن',
        'nheb': 'أريد أن أعرف',
        '7a9i': 'حقوقي',
        '3amil': 'عامل',
        'contrat': 'عقد',
        'travail': 'عمل',
    }
    
    alternatives = [input_text]
    
    # Simple substitution-based augmentation
    for darija, msa in darija_to_msa.items():
        if darija in input_text.lower():
            alt = input_text.lower().replace(darija, msa)
            alternatives.append(alt)
    
    return list(set(alternatives))  # Remove duplicates


if __name__ == "__main__":
    # Analyze the dataset
    stats = analyze_dataset()
    
    # Validate dataset
    is_valid = validate_dataset()
    print(f"\nDataset valid: {is_valid}")
