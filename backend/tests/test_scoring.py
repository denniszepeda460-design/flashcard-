import pytest

def get_similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
        
    # Simple levenshtein distance implementation
    m, n = len(a), len(b)
    d = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        d[i][0] = i
    for j in range(n + 1):
        d[0][j] = j
        
    for j in range(1, n + 1):
        for i in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                d[i][j] = d[i - 1][j - 1]
            else:
                d[i][j] = min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]) + 1
                
    max_len = max(m, n)
    return 1 - (d[m][n] / max_len)

def test_similarity_exact_match():
    assert get_similarity("hello", "hello") == 1.0

def test_similarity_one_char_off():
    sim = get_similarity("hello", "hallo")
    assert 0.6 < sim < 1.0

def test_similarity_completely_different():
    sim = get_similarity("hello", "world")
    assert sim < 0.5

def test_similarity_empty_strings():
    assert get_similarity("", "") == 1.0
    assert get_similarity("a", "") == 0.0
    assert get_similarity("", "b") == 0.0
