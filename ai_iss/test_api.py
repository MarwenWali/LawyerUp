"""
Test script for LawyerUp AI Engine API
Tests the /v1/reply endpoint with various legal questions
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
API_BASE_URL = "http://127.0.0.1:8001"
HEALTH_ENDPOINT = f"{API_BASE_URL}/health"
REPLY_ENDPOINT = f"{API_BASE_URL}/v1/reply"

# Test cases
TEST_QUESTIONS = [
    {
        "language": "Darija",
        "message": "شنية حقوقي في العمل؟",
        "description": "Labor rights in work (Darija)"
    },
    {
        "language": "English",
        "message": "What are my labor rights in Tunisia?",
        "description": "Labor rights in work (English)"
    },
    {
        "language": "French",
        "message": "Quels sont mes droits du travail en Tunisie?",
        "description": "Labor rights in work (French)"
    },
    {
        "language": "Arabic",
        "message": "ما هي حقوقي في العمل؟",
        "description": "Labor rights in work (Modern Standard Arabic)"
    },
]

def test_health() -> bool:
    """Test if API is running"""
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=5)
        if response.status_code == 200:
            print("✓ Health check passed")
            print(f"  Response: {response.json()}\n")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Cannot connect to API server")
        print(f"  Make sure the API is running at {API_BASE_URL}")
        return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

def test_reply(message: str, history: list = None) -> bool:
    """Test the /v1/reply endpoint"""
    if history is None:
        history = []
    
    payload = {
        "message": message,
        "history": history,
        "context": {}
    }
    
    try:
        response = requests.post(REPLY_ENDPOINT, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Response received")
            print(f"  Message: {message[:60]}...")
            print(f"  Answer: {result['response'][:100]}...\n")
            return True
        else:
            print(f"✗ API returned error: {response.status_code}")
            print(f"  Details: {response.text}\n")
            return False
            
    except requests.exceptions.Timeout:
        print("✗ Request timeout (API taking too long to respond)")
        print("  This is normal on first run while model loads\n")
        return False
    except Exception as e:
        print(f"✗ Error: {e}\n")
        return False

def main():
    print("\n" + "="*70)
    print("🇹🇳 LawyerUp AI Engine - API Test Suite")
    print("="*70 + "\n")
    
    # Step 1: Health check
    print("Step 1: Checking API Health...")
    print("-" * 70)
    if not test_health():
        print("\n[ERROR] API is not running!")
        print("\nTo start the API, run:")
        print(r"  .\START_API.ps1")
        return
    
    # Step 2: Test queries
    print("Step 2: Testing Query Endpoints...")
    print("-" * 70)
    
    passed = 0
    failed = 0
    
    for i, test_case in enumerate(TEST_QUESTIONS, 1):
        print(f"Test {i}/{len(TEST_QUESTIONS)}: {test_case['description']}")
        
        if test_reply(test_case['message']):
            passed += 1
        else:
            failed += 1
        
        # Small delay between requests
        if i < len(TEST_QUESTIONS):
            time.sleep(1)
    
    # Summary
    print("="*70)
    print("Test Results")
    print("="*70)
    print(f"✓ Passed: {passed}")
    print(f"✗ Failed: {failed}")
    print(f"Total: {passed + failed}\n")
    
    if failed == 0:
        print("✓ All tests passed! API is working correctly.")
        print("\nYou can now:")
        print("  1. Access API docs at: http://127.0.0.1:8000/docs")
        print("  2. Make requests to: http://127.0.0.1:8000/v1/reply")
        print("  3. Connect from your backend/frontend\n")
    else:
        print("✗ Some tests failed. Check the API server logs.")
        print(r"  Run: .\START_API.ps1\n")

if __name__ == "__main__":
    main()
