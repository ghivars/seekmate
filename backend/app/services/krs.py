"""KRS (study plan) analysis.

A rule-based analysis always works. When an OpenAI-compatible endpoint is configured
(Gemini or Groq free tiers both offer one), the model rewrites the summary, tips and
suggestions; any failure falls back to the rules. Only course data and study preferences
are sent to the provider, never names, emails or chat messages.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.models import UserPreferences

log = logging.getLogger("uvicorn.error")

Load = Literal["ringan", "seimbang", "berat", "sangat_berat"]
DISCLAIMER = (
    "Saran ini bukan pengganti dosen wali atau aturan KRS kampusmu. "
    "Cek lagi jadwal resmi dan prasyarat sebelum mengisi KRS."
)

GOAL_TEXT = {
    "assignment_group": "cari kelompok tugas",
    "exam_prep": "persiapan ujian",
    "concept_discussion": "diskusi materi",
    "just_connect": "cari teman",
}
TIME_TEXT = {"morning": "pagi", "afternoon": "siang", "evening": "malam", "flexible": "fleksibel"}


@dataclass
class CourseFacts:
    id: str
    code: str
    name: str
    faculty: str
    credits: int
    lobby_count: int
    planner_count: int


class CourseAdvice(BaseModel):
    course_id: str
    code: str
    name: str
    credits: int
    lobby_count: int
    planner_count: int
    tip: str


class KrsAnalysis(BaseModel):
    source: Literal["ai", "rules"]
    model: str | None
    total_credits: int
    target_credits: int | None
    load: Load
    summary: str
    courses: list[CourseAdvice]
    suggestions: list[str]
    warnings: list[str]
    disclaimer: str = DISCLAIMER


def load_for(total: int) -> Load:
    if total <= 12:
        return "ringan"
    if total <= 20:
        return "seimbang"
    if total <= 24:
        return "berat"
    return "sangat_berat"


LOAD_TEXT: dict[Load, str] = {
    "ringan": "ringan, masih ada ruang buat organisasi atau kerja paruh waktu",
    "seimbang": "seimbang untuk kebanyakan mahasiswa",
    "berat": "cukup berat, butuh jadwal belajar yang rapi",
    "sangat_berat": "di atas batas umum 24 SKS, biasanya perlu izin khusus",
}


def _tip(course: CourseFacts) -> str:
    if course.lobby_count == 0:
        return "Belum ada lobby. Buka lobby duluan supaya teman sekelas gampang menemukanmu."
    if course.credits >= 4:
        return (
            f"SKS besar. Sudah ada {course.lobby_count} lobby: gabung yang jadwalnya cocok "
            "dan sepakati sesi belajar rutin tiap minggu."
        )
    return f"Sudah ada {course.lobby_count} lobby. Gabung lebih awal sebelum slotnya penuh."


def rule_based(
    courses: list[CourseFacts], prefs: UserPreferences | None, target: int | None
) -> KrsAnalysis:
    total = sum(c.credits for c in courses)
    load = load_for(total)
    warnings: list[str] = []
    suggestions: list[str] = []
    if not courses:
        warnings.append("Belum ada mata kuliah di rencanamu. Tambahkan dulu dari Jelajah.")
    if total > 24:
        warnings.append(f"Total {total} SKS melebihi batas umum 24 SKS.")
    if target is not None and courses:
        gap = target - total
        if gap > 0:
            suggestions.append(f"Masih kurang {gap} SKS dari targetmu ({target} SKS).")
        elif gap < 0:
            suggestions.append(f"Kelebihan {-gap} SKS dari targetmu. Pertimbangkan menunda satu.")
        else:
            suggestions.append("Total SKS sudah pas dengan targetmu.")
    heavy = [c for c in courses if c.credits >= 4]
    if len(heavy) >= 2:
        warnings.append(
            "Ada beberapa mata kuliah berat ("
            + ", ".join(c.code for c in heavy)
            + "). Jangan taruh ujiannya di minggu yang sama kalau bisa memilih kelas."
        )
    lonely = [c for c in courses if c.lobby_count == 0]
    if lonely:
        suggestions.append(
            "Buka lobby untuk "
            + ", ".join(c.code for c in lonely)
            + " supaya tidak belajar sendirian."
        )
    if prefs is not None:
        suggestions.append(
            f"Kamu lebih suka belajar {TIME_TEXT[prefs.preferred_time]} untuk "
            f"{GOAL_TEXT[prefs.study_goal]}. Pakai filter waktu di daftar lobby supaya cocok."
        )
    else:
        suggestions.append("Isi preferensi belajar supaya rekomendasi lobby lebih pas.")
    summary = (
        f"Rencanamu {len(courses)} mata kuliah, total {total} SKS. Bebannya {LOAD_TEXT[load]}."
        if courses
        else "Rencanamu masih kosong."
    )
    return KrsAnalysis(
        source="rules",
        model=None,
        total_credits=total,
        target_credits=target,
        load=load,
        summary=summary,
        courses=[CourseAdvice(**_facts(c), tip=_tip(c)) for c in courses],
        suggestions=suggestions,
        warnings=warnings,
    )


def _facts(c: CourseFacts) -> dict[str, Any]:
    return {
        "course_id": c.id,
        "code": c.code,
        "name": c.name,
        "credits": c.credits,
        "lobby_count": c.lobby_count,
        "planner_count": c.planner_count,
    }


class _AiReply(BaseModel):
    summary: str
    suggestions: list[str]
    warnings: list[str] = []
    tips: dict[str, str] = {}


PROMPT = """Kamu penasihat akademik yang ramah untuk mahasiswa Indonesia.
Analisis rencana KRS berikut dalam bahasa Indonesia santai-sopan. Jangan mengarang
jadwal kelas, nama dosen, atau prasyarat yang tidak ada di data.
Total SKS dan beban sudah dihitung; jangan diubah.
Jawab HANYA JSON: {{"summary": str (maks 3 kalimat), "suggestions": [str] (3-5 butir),
"warnings": [str] (boleh kosong), "tips": {{"<kode>": str (1 kalimat per mata kuliah)}}}}

Data:
{data}"""


async def ai_rewrite(base: KrsAnalysis, prefs: UserPreferences | None, notes: str) -> KrsAnalysis:
    """Ask the configured model to improve the wording; returns `base` on any problem."""
    s = get_settings()
    if not s.ai_api_key:
        return base
    data = {
        "mata_kuliah": [
            {"kode": c.code, "nama": c.name, "sks": c.credits, "lobby_aktif": c.lobby_count}
            for c in base.courses
        ],
        "total_sks": base.total_credits,
        "target_sks": base.target_credits,
        "beban": base.load,
        "preferensi": (
            {"tujuan": GOAL_TEXT[prefs.study_goal], "waktu": TIME_TEXT[prefs.preferred_time]}
            if prefs
            else None
        ),
        "catatan_mahasiswa": notes[:300],
    }
    prompt = PROMPT.format(data=json.dumps(data, ensure_ascii=False))
    body = {
        "model": s.ai_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=s.ai_timeout_seconds) as http:
            res = await http.post(
                f"{s.ai_base_url.rstrip('/')}/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {s.ai_api_key}"},
            )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
        match = re.search(r"\{.*\}", content, re.S)
        reply = _AiReply.model_validate_json(match.group(0) if match else content)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError, ValidationError) as error:
        log.warning("KRS AI analysis failed, using rules: %s", type(error).__name__)
        return base
    extra = [w[:300] for w in reply.warnings[:4]]
    courses = [
        c.model_copy(update={"tip": reply.tips.get(c.code, c.tip)[:300]}) for c in base.courses
    ]
    return base.model_copy(
        update={
            "source": "ai",
            "model": s.ai_model,
            "summary": reply.summary[:600],
            "suggestions": [x[:300] for x in reply.suggestions[:6]] or base.suggestions,
            # Rule warnings (SKS limits) are facts and always stay.
            "warnings": list(dict.fromkeys([*base.warnings, *extra])),
            "courses": courses,
        }
    )
