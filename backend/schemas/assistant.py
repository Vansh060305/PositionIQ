# Shapes of the AI Assistant request/response.

from typing import List
from pydantic import BaseModel, ConfigDict, Field


class AssistantAskRequest(BaseModel):
    # The user's free-form question. Kept intentionally simple - the service
    # decides relevance and builds the real PositionIQ context server-side.
    # Whitespace-only input is trimmed to empty and rejected with a 422.
    model_config = ConfigDict(str_strip_whitespace=True)
    question: str = Field(min_length=1, max_length=2000)


class AssistantResponse(BaseModel):
    # The grounded answer text (or the polite redirect for out-of-scope
    # questions). Never contains raw Gemini errors, stack traces, or prompts.
    answer: str
    # False when the question was judged irrelevant to PositionIQ and no
    # Gemini call was made - the answer then holds the redirect copy.
    relevant: bool
    # Small labels describing which real PositionIQ context sections were
    # attached to the question (e.g. "3 open positions", "Market Pulse"),
    # so the frontend can show where the answer came from without dumping data.
    sources: List[str]