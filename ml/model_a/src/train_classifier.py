"""Train the first A6 explainable phoneme-error classifier from a private feature export."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .error_classifier import ClassifierDataError, read_feature_jsonl, save_training_result, train_classifier


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Train Kotodama Model A A6 phoneme error classifier")
    parser.add_argument("--features", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    parser.add_argument("--target-mode", choices=("three_class", "binary"), default="three_class")
    parser.add_argument("--model", choices=("logistic_regression", "random_forest"), default="logistic_regression")
    parser.add_argument("--seed", type=int, default=2026)
    args = parser.parse_args()
    try:
        result = train_classifier(read_feature_jsonl(args.features), mode=args.target_mode, model_kind=args.model, seed=args.seed)
        save_training_result(result, args.output_directory)
    except ClassifierDataError as error:
        raise SystemExit(str(error)) from error
    print(json.dumps({"artifactDirectory": str(args.output_directory), "metadata": result.metadata, "metrics": result.metrics}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
