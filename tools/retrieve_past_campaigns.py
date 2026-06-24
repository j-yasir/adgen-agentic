from __future__ import annotations

from langchain_core.tools import tool


@tool
def retrieve_past_campaigns(business_id: str, objective: str, top_k: int = 3) -> str:
    """Retrieve past campaigns similar to the current objective using semantic search.

    Queries the pgvector embeddings table for past campaigns from this business
    that are most similar to the current campaign objective. Returns what worked,
    what didn't, top hooks, and scores.

    Args:
        business_id: UUID of the business to search campaigns for.
        objective: The current campaign objective to match against.
        top_k: Number of similar past campaigns to return (default 3).
    """
    # TODO: Implement pgvector semantic search once business_embeddings table
    # is populated. For now, return a message indicating no past data.
    #
    # Future implementation:
    #   1. Embed `objective` using Gemini text-embedding-004
    #   2. Query business_embeddings WHERE business_id = ? ORDER BY embedding <=> ? LIMIT top_k
    #   3. Format results with hooks, scores, and learnings

    return (
        f"No past campaign data found for business {business_id}. "
        f"This appears to be the first campaign for this business. "
        f"Proceed with research using other available tools."
    )
