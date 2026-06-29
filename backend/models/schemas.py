from typing import Any

from pydantic import BaseModel, Field


MAX_ARTIFACT_CHARS = 500_000


class Artifact(BaseModel):
    name: str = Field(..., max_length=160)
    type: str | None = Field(default="Artifact", max_length=80)
    content: str = Field(..., max_length=MAX_ARTIFACT_CHARS)
    source: str | None = Field(default=None, max_length=40)
    badge: str | None = Field(default=None, max_length=40)
    meta: dict[str, Any] | None = None


class AnalyzeRequest(BaseModel):
    artifacts: list[Artifact] = Field(default_factory=list)
    source: str = Field(default="upload", max_length=40)
    jira_data: Any | None = None
    meeting_notes: str | None = Field(default=None, max_length=MAX_ARTIFACT_CHARS)
    build_log: str | None = Field(default=None, max_length=MAX_ARTIFACT_CHARS)
    email_thread: str | None = Field(default=None, max_length=MAX_ARTIFACT_CHARS)


class UploadRequest(BaseModel):
    files: list[Artifact] = Field(default_factory=list)


class CommentRequest(BaseModel):
    issue_key: str = Field(..., max_length=80)
    comment: str = Field(..., max_length=8000)
