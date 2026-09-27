export interface DiffResult {
  char: string;
  status: 'correct' | 'incorrect' | 'missing' | 'extra';
}

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[a.length][b.length];
}

export function charDiff(input: string, expected: string): DiffResult[] {
  // Simple diff for demonstration, actual diff can be more complex
  const diffs: DiffResult[] = [];
  const minLen = Math.min(input.length, expected.length);
  for (let i = 0; i < minLen; i++) {
    if (input[i] === expected[i]) {
      diffs.push({ char: input[i], status: 'correct' });
    } else {
      diffs.push({ char: input[i], status: 'incorrect' });
    }
  }
  if (input.length > expected.length) {
    for (let i = minLen; i < input.length; i++) {
      diffs.push({ char: input[i], status: 'extra' });
    }
  } else if (expected.length > input.length) {
    for (let i = minLen; i < expected.length; i++) {
      diffs.push({ char: expected[i], status: 'missing' });
    }
  }
  return diffs;
}

export function scoreSimilarity(input: string, expected: string): { rating: 1 | 2 | 3 | 4, similarity: number, feedback: string } {
  const maxLen = Math.max(input.length, expected.length);
  if (maxLen === 0) return { rating: 4, similarity: 1, feedback: '¡Perfecto!' };
  
  const distance = levenshteinDistance(input, expected);
  const similarity = 1 - distance / maxLen;

  if (similarity === 1.0) {
    return { rating: 4, similarity, feedback: '¡Perfecto!' };
  } else if (similarity >= 0.85) {
    return { rating: 3, similarity, feedback: '¡Casi!' };
  } else if (similarity >= 0.60) {
    return { rating: 2, similarity, feedback: 'Parcialmente correcto' };
  } else {
    return { rating: 1, similarity, feedback: 'Incorrecto' };
  }
}

export function scoreScrambled(userOrder: string[], correctOrder: string[]): { rating: 1 | 2 | 3, correctCount: number, totalCount: number } {
  let correctCount = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (userOrder[i] === correctOrder[i]) correctCount++;
  }
  
  const similarity = correctCount / correctOrder.length;
  let rating: 1 | 2 | 3 = 1;
  if (similarity === 1.0) rating = 3;
  else if (similarity >= 0.5) rating = 2;
  
  return { rating, correctCount, totalCount: correctOrder.length };
}
