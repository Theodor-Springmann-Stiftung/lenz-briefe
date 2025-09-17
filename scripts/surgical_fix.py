#!/usr/bin/env python3
"""
Surgical fix using exact string patterns found in the file.
"""

import sys

def fix_align_patterns(content):
    """Fix known problematic align patterns."""

    transformations = 0

    # List of exact patterns to replace
    patterns = [
        # Pattern 1: Simple case with line break in middle
        (
            '<align pos="right">gehorsamsten Diener\n<line type="break" />Jacob Michael Reinhold Lenz</align>',
            '<align pos="right">gehorsamsten Diener</align>\n<line type="break" /><align pos="right">Jacob Michael Reinhold Lenz</align>'
        ),

        # Pattern 2: Multi-line signature block
        (
            '<align pos="right">Hoch Edelgeborner Hochgelahrter Herr <aq>Secretair</aq>\n<line type="break" tab="7" />Verehrungswürdigster Gönner\n<line type="break" tab="7" />Ew. HochEdelgebh:</align>',
            '<align pos="right">Hoch Edelgeborner Hochgelahrter Herr <aq>Secretair</aq></align>\n<line type="break" tab="7" /><align pos="right">Verehrungswürdigster Gönner</align>\n<line type="break" tab="7" /><align pos="right">Ew. HochEdelgebh:</align>'
        ),

        # Pattern 3: With <aq> tag containing line break
        (
            '<align pos="center">\n  <aq>Interfusa nitentes\n<line type="break"/>Vites aequora Cycladas.</aq>\n</align>',
            '<align pos="center">\n  <aq>Interfusa nitentes</aq></align>\n<line type="break"/><align pos="center"><aq>Vites aequora Cycladas.</aq>\n</align>'
        ),

        # Pattern 4: Signature with aq
        (
            '<align pos="right">Sie ewig liebender <aq>Alcibiades</aq>\n<line type="break"/>J. M. R. L.</align>',
            '<align pos="right">Sie ewig liebender <aq>Alcibiades</aq></align>\n<line type="break"/><align pos="right">J. M. R. L.</align>'
        ),
    ]

    for old_pattern, new_pattern in patterns:
        if old_pattern in content:
            content = content.replace(old_pattern, new_pattern)
            transformations += 1
            print(f"Applied transformation {transformations}")

    # Now handle the more complex multi-line patterns using targeted replacements
    # Let's find and fix the complex ones one by one

    # Find patterns like "text<line/>text" within align tags
    import re

    # Pattern for align elements containing line breaks
    align_pattern = r'<align pos="([^"]+)"[^>]*>(.*?)</align>'

    def fix_align_content(match):
        pos = match.group(1)
        content_part = match.group(2)

        # Check if this content contains line elements
        if '<line' not in content_part:
            return match.group(0)  # No change needed

        # Split on line elements, preserving the line elements
        parts = re.split(r'(<line[^>]*(?:/>|></line>))', content_part)

        result = []
        current_text = ""

        for part in parts:
            if part.startswith('<line'):
                # This is a line element
                if current_text.strip():
                    result.append(f'<align pos="{pos}">{current_text}</align>')
                    current_text = ""
                result.append(part)
            else:
                current_text += part

        # Add remaining text
        if current_text.strip():
            result.append(f'<align pos="{pos}">{current_text}</align>')

        return ''.join(result)

    # Apply the pattern replacement
    new_content = re.sub(align_pattern, fix_align_content, content, flags=re.DOTALL)

    if new_content != content:
        additional_transforms = len(re.findall(r'</align>\s*<line', new_content)) - len(re.findall(r'</align>\s*<line', content))
        transformations += additional_transforms
        print(f"Applied {additional_transforms} additional regex transformations")

    print(f"Total transformations: {transformations}")
    return new_content

def main():
    if len(sys.argv) != 2:
        print("Usage: python surgical_fix.py FILE.xml")
        sys.exit(1)

    file_path = sys.argv[1]

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    transformed_content = fix_align_patterns(content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(transformed_content)

    print("Surgical fix complete!")

if __name__ == "__main__":
    main()