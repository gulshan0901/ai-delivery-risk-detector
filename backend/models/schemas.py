from typing import Any

from pydantic import BaseModel, Field, model_validator


MAX_ARTIFACT_CHARS = 180_000
MAX_ARTIFACTS = 10
MAX_TOTAL_ARTIFACT_CHARS = 500_000


class Artifact(BaseModel):
    name: str = Field(..., max_length=160)
    type: str | None = Field(default="Artifact", max_length=80)
    content: str = Field(..., max_length=MAX_ARTIFACT_CHARS)
    source: str | None = Field(default=None, max_length=40)
    badge: str | None = Field(default=None, max_length=40)
    meta: dict[str, Any] | None = None


class AnalyzeRequest(BaseModel):
    artifacts: list[Artifact] = Field(default_factory=list, max_length=MAX_ARTIFACTS)
    source: str = Field(default="upload", max_length=40)
    jira_data: Any | None = None
    meeting_notes: str | None = Field(default=None, max_length=MAX_ARTIFACT_CHARS)
    build_log: str | None = Field(default=None, max_length=MAX_ARTIFACT_CHARS)
    email_thread: str | None = Field(default=None, max_length=MAX_ARTIFACT_CHARS)

    @model_validator(mode="after")
    def validate_total_input_size(self):
        total = sum(len(item.content) for item in self.artifacts)
        total += len(self.meeting_notes or "") + len(self.build_log or "") + len(self.email_thread or "")
        if total > MAX_TOTAL_ARTIFACT_CHARS:
            raise ValueError(f"Combined artifact content exceeds {MAX_TOTAL_ARTIFACT_CHARS} characters.")
        return self


class UploadRequest(BaseModel):
    files: list[Artifact] = Field(default_factory=list, max_length=MAX_ARTIFACTS)

    @model_validator(mode="after")
    def validate_total_input_size(self):
        if sum(len(item.content) for item in self.files) > MAX_TOTAL_ARTIFACT_CHARS:
            raise ValueError(f"Combined artifact content exceeds {MAX_TOTAL_ARTIFACT_CHARS} characters.")
        return self


class CommentRequest(BaseModel):
    issue_key: str = Field(..., max_length=80)
    comment: str = Field(..., max_length=8000)
