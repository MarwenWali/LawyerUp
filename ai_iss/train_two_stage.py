"""
Run the full two-stage pipeline:
1) Prepare datasets
2) Train translator model (Tunisian -> MSA)
3) Train legal model (MSA -> legal answer)
"""

import argparse
import logging
import subprocess
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def resolve_python_interpreter(explicit: str | None = None) -> str:
    """Pick a Python interpreter for all stages, preferring local venv when available."""
    if explicit:
        return explicit

    script_dir = Path(__file__).resolve().parent
    candidates = []

    # Search current directory and ancestor folders for .venv.
    search_roots = [script_dir, *script_dir.parents]
    for root in search_roots:
        candidates.append(root / ".venv" / "Scripts" / "python.exe")
        candidates.append(root / ".venv" / "bin" / "python")

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    return sys.executable


def run_stage(python_exe: str, script_name: str, extra_args: list[str] | None = None) -> None:
    cmd = [python_exe, script_name]
    if extra_args:
        cmd.extend(extra_args)

    logger.info("Running: %s", " ".join(cmd))
    subprocess.run(cmd, cwd=str(Path(__file__).resolve().parent), check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train two-stage Tunisian legal assistant")
    parser.add_argument(
        "--python",
        type=str,
        default=None,
        help="Optional Python interpreter path to use for all stages",
    )
    parser.add_argument("--prepare-only", action="store_true", help="Only build datasets")
    parser.add_argument("--skip-translator", action="store_true", help="Skip stage-1 translator training")
    parser.add_argument("--skip-legal", action="store_true", help="Skip stage-2 legal model training")
    args = parser.parse_args()

    python_exe = resolve_python_interpreter(args.python)
    logger.info("Using Python interpreter: %s", python_exe)

    logger.info("Preparing datasets...")
    run_stage(python_exe, "prepare_two_stage_data.py")

    if args.prepare_only:
        logger.info("Done. prepare-only flag was used.")
        return

    if not args.skip_translator:
        logger.info("Training stage-1 translator model...")
        run_stage(python_exe, "train_translator.py")
    else:
        logger.info("Skipping stage-1 translator training")

    if not args.skip_legal:
        logger.info("Training stage-2 legal model...")
        run_stage(python_exe, "train.py")
    else:
        logger.info("Skipping stage-2 legal model training")

    logger.info("Two-stage training workflow completed")


if __name__ == "__main__":
    main()
