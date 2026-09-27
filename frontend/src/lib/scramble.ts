export function tokenize(sentence: string): string[] {
  return sentence.trim().split(/\s+/);
}

export function shuffleTokens(tokens: string[]): string[] {
  if (tokens.length <= 1) return [...tokens];
  
  let shuffled = [...tokens];
  let isDifferent = false;
  
  // Try up to 10 times to get a different order
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Check if different
    isDifferent = false;
    for (let i = 0; i < tokens.length; i++) {
      if (shuffled[i] !== tokens[i]) {
        isDifferent = true;
        break;
      }
    }
    if (isDifferent) break;
  }
  
  return shuffled;
}
