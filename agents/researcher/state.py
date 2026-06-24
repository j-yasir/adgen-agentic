from __future__ import annotations
from typing import TypedDict
from langchain_core.messages import BaseMessage


class ResearcherState(TypedDict):
    messages:  list[BaseMessage]
    bko_draft: dict | None
    gaps:      list[str]
    attempts:  int
