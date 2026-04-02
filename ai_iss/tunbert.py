from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

model_name = "aubmindlab/bert-base-arabertv2"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=3)

labels = ["legal", "casual", "other"]

def detect_intent(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    
    with torch.no_grad():
        outputs = model(**inputs)
    
    pred = torch.argmax(outputs.logits).item()
    return labels[pred]