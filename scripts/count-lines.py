#!/usr/bin/env python3
"""
Code Size Analysis Tool

Counts lines in all .ts/.tsx source files, categorizes them,
and flags files exceeding size thresholds.

Usage:
    python scripts/count-lines.py              # Full categorized report
    python scripts/count-lines.py --top 20     # Top 20 largest files
    python scripts/count-lines.py --critical   # Only critical (>500) and warning (>400) files
    python scripts/count-lines.py --category services   # Filter by category
    python scripts/count-lines.py --json       # JSON output for automation
"""

import os
import sys
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# Thresholds
CRITICAL_THRESHOLD = 500
WARNING_THRESHOLD = 400

# Color codes for terminal output
class Colors:
    RED = "\033[91m"
    YELLOW = "\033[93m"
    GREEN = "\033[92m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"

    @staticmethod
    def enabled():
        return sys.stdout.isatty()

    @classmethod
    def red(cls, text):
        return f"{cls.RED}{text}{cls.RESET}" if cls.enabled() else text

    @classmethod
    def yellow(cls, text):
        return f"{cls.YELLOW}{text}{cls.RESET}" if cls.enabled() else text

    @classmethod
    def green(cls, text):
        return f"{cls.GREEN}{text}{cls.RESET}" if cls.enabled() else text

    @classmethod
    def cyan(cls, text):
        return f"{cls.CYAN}{text}{cls.RESET}" if cls.enabled() else text

    @classmethod
    def bold(cls, text):
        return f"{cls.BOLD}{text}{cls.RESET}" if cls.enabled() else text

    @classmethod
    def dim(cls, text):
        return f"{cls.DIM}{text}{cls.RESET}" if cls.enabled() else text


@dataclass
class FileInfo:
    path: str
    lines: int
    category: str

    @property
    def status(self) -> str:
        if self.lines > CRITICAL_THRESHOLD:
            return "critical"
        elif self.lines > WARNING_THRESHOLD:
            return "warning"
        else:
            return "good"

    @property
    def status_icon(self) -> str:
        if self.lines > CRITICAL_THRESHOLD:
            return Colors.red("!!") if Colors.enabled() else "!!"
        elif self.lines > WARNING_THRESHOLD:
            return Colors.yellow("!") if Colors.enabled() else "!"
        else:
            return Colors.green(".") if Colors.enabled() else "."


@dataclass
class CategoryStats:
    name: str
    total_files: int = 0
    critical: int = 0
    warning: int = 0
    good: int = 0
    total_lines: int = 0
    files: list = field(default_factory=list)


def find_project_root() -> Path:
    """Find project root by looking for package.json."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    # Fallback to script's parent's parent
    return Path(__file__).resolve().parent.parent


def categorize_file(rel_path: str) -> str:
    """Categorize a file based on its path."""
    parts = rel_path.replace("\\", "/")

    if "/ipc/" in parts:
        return "IPC Handlers"
    elif "/store/" in parts or "/stores/" in parts:
        return "Stores"
    elif "/pages/" in parts:
        return "Pages"
    elif "/main/services/" in parts:
        return "Main Services"
    elif "/components/" in parts or "useSmartSearchWorkflow" in parts:
        return "Renderer Components"
    elif "/preload/" in parts:
        return "Preload"
    elif "/shared/" in parts:
        return "Shared"
    elif "/renderer/" in parts:
        return "Renderer Other"
    elif "/main/" in parts:
        return "Main Other"
    else:
        return "Other"


def count_lines(file_path: Path) -> int:
    """Count lines in a file."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return sum(1 for _ in f)
    except (OSError, IOError):
        return 0


def scan_files(src_dir: Path) -> list[FileInfo]:
    """Scan all .ts/.tsx files in src/, excluding test files."""
    files = []
    exclude_patterns = {".spec.", ".test.", "__tests__", "__mocks__"}

    for root, dirs, filenames in os.walk(src_dir):
        # Skip node_modules and dist
        dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", ".git")]

        for filename in filenames:
            if not (filename.endswith(".ts") or filename.endswith(".tsx")):
                continue
            if any(p in filename for p in exclude_patterns):
                continue

            filepath = Path(root) / filename
            rel_path = str(filepath.relative_to(src_dir.parent))
            lines = count_lines(filepath)

            files.append(FileInfo(
                path=rel_path,
                lines=lines,
                category=categorize_file(rel_path),
            ))

    files.sort(key=lambda f: f.lines, reverse=True)
    return files


def build_stats(files: list[FileInfo]) -> dict[str, CategoryStats]:
    """Build per-category statistics."""
    stats: dict[str, CategoryStats] = {}

    for f in files:
        if f.category not in stats:
            stats[f.category] = CategoryStats(name=f.category)

        cat = stats[f.category]
        cat.total_files += 1
        cat.total_lines += f.lines
        cat.files.append(f)

        if f.lines > CRITICAL_THRESHOLD:
            cat.critical += 1
        elif f.lines > WARNING_THRESHOLD:
            cat.warning += 1
        else:
            cat.good += 1

    return stats


def print_summary_table(stats: dict[str, CategoryStats]):
    """Print summary statistics table."""
    # Header
    print()
    print(Colors.bold("Category Summary"))
    print(Colors.dim("-" * 82))
    print(
        f"  {'Category':<25} {'Files':>6} {'Critical':>9} {'Warning':>9} "
        f"{'Good':>6} {'Total Lines':>12}"
    )
    print(Colors.dim("-" * 82))

    # Sort categories by total critical + warning descending
    ordered = sorted(
        stats.values(),
        key=lambda s: (s.critical, s.warning, s.total_lines),
        reverse=True,
    )

    total_files = 0
    total_critical = 0
    total_warning = 0
    total_good = 0
    total_lines = 0

    for cat in ordered:
        crit_str = Colors.red(str(cat.critical)) if cat.critical else str(cat.critical)
        warn_str = Colors.yellow(str(cat.warning)) if cat.warning else str(cat.warning)

        # For alignment, we need raw numbers for padding
        print(
            f"  {cat.name:<25} {cat.total_files:>6} {cat.critical:>9} "
            f"{cat.warning:>9} {cat.good:>6} {cat.total_lines:>12,}"
        )

        total_files += cat.total_files
        total_critical += cat.critical
        total_warning += cat.warning
        total_good += cat.good
        total_lines += cat.total_lines

    print(Colors.dim("-" * 82))
    print(
        f"  {'TOTAL':<25} {total_files:>6} {total_critical:>9} "
        f"{total_warning:>9} {total_good:>6} {total_lines:>12,}"
    )
    print()


def print_file_list(
    files: list[FileInfo],
    limit: Optional[int] = None,
    category_filter: Optional[str] = None,
    critical_only: bool = False,
):
    """Print file list with line counts."""
    filtered = files

    if category_filter:
        cat_lower = category_filter.lower()
        filtered = [f for f in filtered if cat_lower in f.category.lower()]

    if critical_only:
        filtered = [f for f in filtered if f.status in ("critical", "warning")]

    if limit:
        filtered = filtered[:limit]

    if not filtered:
        print("  No files matching criteria.")
        return

    print()
    if critical_only:
        print(Colors.bold("Critical & Warning Files"))
    else:
        print(Colors.bold(f"Files by Size{f' (top {limit})' if limit else ''}"))
    print(Colors.dim("-" * 82))

    prev_category = None
    for f in filtered:
        # Show category separator
        if not category_filter and f.category != prev_category:
            if prev_category is not None:
                print()
            print(f"  {Colors.cyan(f.category)}")
            prev_category = f.category

        # Color the line count
        if f.lines > CRITICAL_THRESHOLD:
            count_str = Colors.red(f"{f.lines:>6}")
            marker = Colors.red(" !! CRITICAL")
        elif f.lines > WARNING_THRESHOLD:
            count_str = Colors.yellow(f"{f.lines:>6}")
            marker = Colors.yellow(" !  WARNING")
        else:
            count_str = Colors.green(f"{f.lines:>6}")
            marker = ""

        print(f"    {count_str}  {f.path}{marker}")

    print()


def print_json(files: list[FileInfo], stats: dict[str, CategoryStats]):
    """Print JSON output for automation."""
    output = {
        "thresholds": {
            "critical": CRITICAL_THRESHOLD,
            "warning": WARNING_THRESHOLD,
        },
        "summary": {
            cat_name: {
                "total_files": cat.total_files,
                "critical": cat.critical,
                "warning": cat.warning,
                "good": cat.good,
                "total_lines": cat.total_lines,
            }
            for cat_name, cat in stats.items()
        },
        "files": [
            {
                "path": f.path,
                "lines": f.lines,
                "category": f.category,
                "status": f.status,
            }
            for f in files
        ],
    }
    print(json.dumps(output, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Analyze code size of .ts/.tsx source files"
    )
    parser.add_argument(
        "--top", type=int, default=None,
        help="Show only the top N largest files"
    )
    parser.add_argument(
        "--critical", action="store_true",
        help="Show only critical (>500) and warning (>400) files"
    )
    parser.add_argument(
        "--category", type=str, default=None,
        help="Filter by category (e.g., 'services', 'components', 'pages')"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output as JSON for automation"
    )
    parser.add_argument(
        "--no-summary", action="store_true",
        help="Skip the summary table"
    )

    args = parser.parse_args()

    project_root = find_project_root()
    src_dir = project_root / "src"

    if not src_dir.exists():
        print(f"Error: src/ directory not found at {src_dir}", file=sys.stderr)
        sys.exit(1)

    files = scan_files(src_dir)
    stats = build_stats(files)

    if args.json:
        print_json(files, stats)
        return

    # Header
    print()
    print(Colors.bold(f"Code Size Analysis — {project_root.name}"))
    print(Colors.dim(f"Source: {src_dir}"))
    print(Colors.dim(f"Thresholds: critical > {CRITICAL_THRESHOLD}, warning > {WARNING_THRESHOLD}"))
    total = sum(f.lines for f in files)
    print(Colors.dim(f"Total: {len(files)} files, {total:,} lines"))

    if not args.no_summary:
        print_summary_table(stats)

    # Determine what to show
    if args.critical:
        print_file_list(files, category_filter=args.category, critical_only=True)
    elif args.category:
        print_file_list(files, limit=args.top, category_filter=args.category)
    else:
        print_file_list(files, limit=args.top or 30, category_filter=args.category)

    # Quick health check
    critical_count = sum(1 for f in files if f.status == "critical")
    warning_count = sum(1 for f in files if f.status == "warning")

    if critical_count:
        print(Colors.red(f"  {critical_count} file(s) exceed {CRITICAL_THRESHOLD} lines — refactoring recommended"))
    if warning_count:
        print(Colors.yellow(f"  {warning_count} file(s) in {WARNING_THRESHOLD}-{CRITICAL_THRESHOLD} line warning zone"))
    if not critical_count and not warning_count:
        print(Colors.green("  All files within healthy size limits!"))
    print()


if __name__ == "__main__":
    main()
