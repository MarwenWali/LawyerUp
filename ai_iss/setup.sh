#!/bin/bash
# Tunisian Arabic Legal AI - Quick Setup Script (Linux/Mac)

echo ""
echo "========================================"
echo "🇹🇳 Tunisian Arabic Legal AI Setup"
echo "========================================"
echo ""

# Check Python installation
echo "✓ Checking Python installation..."
python_version=$(python3 --version 2>&1)
if [ $? -ne 0 ]; then
    echo "✗ Python 3 not found. Please install Python 3.8+"
    exit 1
fi
echo "  Found: $python_version"
echo ""

# Create virtual environment
echo "✓ Setting up virtual environment..."
if [ ! -d "mistral_env" ]; then
    python3 -m venv mistral_env
    echo "  Created: mistral_env"
else
    echo "  Found existing: mistral_env"
fi

# Activate virtual environment
source mistral_env/bin/activate
echo ""

# Upgrade pip
echo "✓ Upgrading pip..."
pip install --upgrade pip -q

# Install PyTorch
echo "✓ Installing PyTorch..."
pip install torch torchvision torchaudio -q

# Install dependencies
echo "✓ Installing dependencies..."
echo "  Installing: transformers, datasets, TRL..."
pip install -r requirements.txt -q

if [ $? -ne 0 ]; then
    echo "✗ Failed to install dependencies"
    echo "  Try running: pip install -r requirements.txt"
    exit 1
fi

echo ""
echo "✓ All dependencies installed!"
echo ""

# Verify dataset
echo "✓ Checking dataset..."
if [ -f "data/tunisian_legal.json" ]; then
    data_size=$(du -h data/tunisian_legal.json | cut -f1)
    echo "  Found: data/tunisian_legal.json ($data_size)"
else
    echo "  ⚠ Dataset not found at data/tunisian_legal.json"
    echo "    Please add your training data before proceeding"
fi

# Display next steps
echo ""
echo "========================================"
echo "✓ Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Start the interactive assistant:"
echo "   python app.py"
echo ""
echo "2. Train both models (translator + legal):"
echo "   python train_two_stage.py"
echo ""
echo "3. Test the model:"
echo "   python test.py"
echo ""
echo "4. Run interactive testing:"
echo "   python test.py --interactive"
echo ""
echo "For more information, see README.md"
echo ""
