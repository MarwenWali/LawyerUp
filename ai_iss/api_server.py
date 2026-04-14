"""
FastAPI runtime for Tunisian legal AI assistant.
This service is intended to be called by the Node backend only.
"""

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from generator import generate_answer
from router import detect_intent, is_follow_up


class HistoryItem(BaseModel):
    sender: str
    content: str


class ReplyRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[HistoryItem] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class ReplyResponse(BaseModel):
    response: str


app = FastAPI(title="LawyerUp AI Engine", version="1.0.0")


def _build_follow_up_prompt(message: str, history: list[HistoryItem]) -> str:
    previous_user_question = ""
    for item in reversed(history):
        if item.sender == "user" and item.content.strip() and item.content.strip() != message.strip():
            previous_user_question = item.content.strip()
            break

    if not previous_user_question:
        return message

    return (
        f"Previous question: {previous_user_question}\n\n"
        f"User follow-up: {message}\n"
        "Provide step-by-step practical legal guidance in the same language as the user."
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/reply", response_model=ReplyResponse)
def reply(payload: ReplyRequest) -> ReplyResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    try:
        if is_follow_up(message) and payload.history:
            prompt = _build_follow_up_prompt(message, payload.history)
            return ReplyResponse(response=generate_answer(prompt))

        if detect_intent(message) == "legal":
            return ReplyResponse(response=generate_answer(message))

        return ReplyResponse(
            response=(
                "نجم نعاونك في حاجة قانونية ولاّ؟\n"
                "Can I help you with a legal question?\n"
                "Je peux t'aider avec une question legale?"
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {exc}") from exc


@app.post("/v1/analyze-case")
def analyze_case(_: dict[str, Any]) -> dict[str, str]:
    raise HTTPException(status_code=501, detail="Not implemented yet")


@app.post("/v1/match-lawyers")
def match_lawyers(_: dict[str, Any]) -> dict[str, list[str]]:
    raise HTTPException(status_code=501, detail="Not implemented yet")
