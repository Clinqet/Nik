import re
def has_identifier(texts):
    for text in texts:
        for raw in text.split():
            token = raw.strip("(),.;:\"'?!")
            if any(c.isalpha() for c in token) and any(c.isdigit() for c in token): return True
    return False
