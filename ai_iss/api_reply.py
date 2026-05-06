"""
Lightweight JSON bridge for the Tunisian legal assistant.

Input (stdin JSON):
{
  "message": "latest user message",
  "history": [{"sender": "user|ai", "content": "..."}]
}

Output (stdout JSON):
{
  "response": "assistant text"
}
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from typing import Any


CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)


def _read_payload() -> dict[str, Any]:
    raw = (sys.stdin.read() or "").strip()
    if not raw:
        return {}

    try:
        payload = json.loads(raw)
    except Exception as exc:
        raise ValueError(f"Invalid JSON payload: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")

    return payload


def _safe_history_items(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    items: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        sender = str(item.get("sender", "")).strip().lower()
        content = str(item.get("content", "")).strip()
        if sender and content:
            items.append({"sender": sender, "content": content})
    return items


def main() -> int:
    try:
        payload = _read_payload()
        message = str(payload.get("message", "")).strip()
        if not message:
            print(json.dumps({"error": "message is required"}, ensure_ascii=False))
            return 2

        history = _safe_history_items(payload.get("history"))

        from router import handle_request  # local import to keep startup robust

        # Prime lightweight conversational memory for follow-up handling.
        for item in history[-12:]:
            if item["sender"] == "user":
                try:
                    handle_request(item["content"])
                except Exception:
                    # Best-effort priming only.
                    pass

        response = str(handle_request(message)).strip()
        print(json.dumps({"response": response}, ensure_ascii=False))
        return 0
    except Exception as exc:
        error_payload = {
            "error": str(exc),
            "traceback": traceback.format_exc(limit=6),
        }
        print(json.dumps(error_payload, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
