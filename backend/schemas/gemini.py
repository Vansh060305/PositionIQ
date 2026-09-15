from pydantic import BaseModel


class AIAssistantRequest(BaseModel):
    question: str


class AIAssistantResponse(BaseModel):
    answer: str
