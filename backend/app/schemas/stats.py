from pydantic import BaseModel

class TodayStats(BaseModel):
    studied_today: int
    streak_days: int
    retention_rate: float
    new_seen: int
    reviews_done: int
