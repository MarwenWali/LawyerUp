from transformers import AutoTokenizer, AutoModel
import torch

model_name = "UBC-NLP/TunBERT"

tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

text = "chneya nafeka"

inputs = tokenizer(text, return_tensors="pt")

with torch.no_grad():
    outputs = model(**inputs)

print(outputs.last_hidden_state.shape)