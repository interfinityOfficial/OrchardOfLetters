#!/usr/bin/env python3
"""
Filter all.txt by removing words that appear in blocklist.txt
"""

import os

def load_blocklist(blocklist_path):
    """Load blocklist and return a set of blocked words (lowercase).
    Only blocks single words, not parts of multi-word phrases."""
    blocked_words = set()
    with open(blocklist_path, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip().lower()
            if word:
                # Only add single words (no spaces) to the blocklist
                # Multi-word phrases like "ball gag" won't block "ball" or "gag" individually
                if ' ' not in word:
                    blocked_words.add(word)
    return blocked_words

def filter_wordlist(input_path, output_path, blocked_words):
    """Filter the wordlist, removing blocked words."""
    kept_count = 0
    removed_count = 0
    removed_words = []
    
    with open(input_path, 'r', encoding='utf-8') as infile, \
         open(output_path, 'w', encoding='utf-8') as outfile:
        for line in infile:
            word = line.strip()
            if word.lower() not in blocked_words:
                outfile.write(word + '\n')
                kept_count += 1
            else:
                removed_count += 1
                removed_words.append(word)
    
    return kept_count, removed_count, removed_words

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    blocklist_path = os.path.join(script_dir, 'blocklist.txt')
    input_path = os.path.join(script_dir, 'all.txt')
    output_path = os.path.join(script_dir, 'all_filtered.txt')
    
    print("Loading blocklist...")
    blocked_words = load_blocklist(blocklist_path)
    print(f"Loaded {len(blocked_words)} blocked single-words")
    
    print("\nFiltering wordlist...")
    kept, removed, removed_words = filter_wordlist(input_path, output_path, blocked_words)
    
    print(f"\n--- Removed Words ---")
    for w in removed_words:
        print(f"  {w}")
    
    print(f"\n--- Summary ---")
    print(f"Words kept: {kept}")
    print(f"Words removed: {removed}")
    print(f"Output written to: {output_path}")

if __name__ == '__main__':
    main()
