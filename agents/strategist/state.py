from __future__ import annotations
from typing import TypedDict
from langchain_core.messages import BaseMessage


class StrategistState(TypedDict):
    messages:   list[BaseMessage]
    strategy:   dict | None
    iterations: int
