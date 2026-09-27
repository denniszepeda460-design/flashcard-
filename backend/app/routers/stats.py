import time
from fastapi import APIRouter, Request
from app.schemas.stats import TodayStats

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/today", response_model=TodayStats)
async def get_today_stats(request: Request):
    """Obtiene las estadísticas del día: cartas estudiadas, racha, retención."""
    cm = request.app.state.collection_manager
    with cm.get_collection() as col:
        # Get today's cutoff timestamp (start of review day)
        today_cutoff = col.sched.day_cutoff - 86400  # seconds in a day

        # Query revlog for today's reviews
        today_cutoff_ms = today_cutoff * 1000
        revlog_today = col.db.list(
            "SELECT id FROM revlog WHERE id >= ?", today_cutoff_ms
        )
        reviews_done = len(revlog_today)

        # Count reviews that were "passed" (ease >= 2)
        correct_count = col.db.scalar(
            "SELECT COUNT() FROM revlog WHERE id >= ? AND ease >= 2",
            today_cutoff_ms,
        ) or 0

        retention_rate = (correct_count / reviews_done * 100) if reviews_done > 0 else 0.0

        # Count new cards seen today
        new_seen = col.db.scalar(
            "SELECT COUNT() FROM revlog WHERE id >= ? AND type = 0",
            today_cutoff_ms,
        ) or 0

        # Calculate streak: count consecutive days with at least 1 review
        streak_days = 0
        day_offset = 0
        while True:
            day_start = (today_cutoff - (day_offset * 86400)) * 1000
            day_end = day_start + 86400000
            day_count = col.db.scalar(
                "SELECT COUNT() FROM revlog WHERE id >= ? AND id < ?",
                day_start,
                day_end,
            ) or 0
            if day_count > 0:
                streak_days += 1
                day_offset += 1
            else:
                break
            # Safety limit
            if day_offset > 365:
                break

        return TodayStats(
            studied_today=reviews_done,
            streak_days=streak_days,
            retention_rate=round(retention_rate, 1),
            new_seen=new_seen,
            reviews_done=reviews_done,
        )
