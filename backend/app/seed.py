"""Idempotent seed: SAMPLE courses plus clearly labelled demo users and lobbies.

Run with `python -m app.seed`. Nothing here represents real courses, people or statistics.
"""

from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import SessionFactory, engine
from app.enums import (
    Atmosphere,
    CommunicationStyle,
    Language,
    MemberRole,
    PreferredTime,
    StudyGoal,
    UserRole,
)
from app.models import (
    Course,
    Lobby,
    LobbyMember,
    Message,
    Semester,
    User,
    UserPlannedCourse,
    UserPreferences,
)
from app.security import hash_password

# Shared by every demo account. Seeding is refused when ENVIRONMENT=production.
DEMO_PASSWORD = "demo-seekmate-123"  # noqa: S105
DEMO_DOMAIN = "demo.seekmate.example"
NAMESPACE = uuid.UUID("5eec3a7e-0000-4000-8000-000000000001")

COURSES = [
    ("CTH101", "Algoritma dan Pemrograman", "Informatika", 3),
    ("CTH102", "Kalkulus I", "Matematika", 3),
    ("CTH103", "Fisika Dasar", "Fisika", 3),
    ("CTH104", "Pengantar Ekonomi Mikro", "Ekonomi", 3),
    ("CTH105", "Statistika Dasar", "Statistika", 3),
    ("CTH106", "Basis Data", "Informatika", 3),
    ("CTH107", "Psikologi Umum", "Psikologi", 2),
    ("CTH108", "Pengantar Ilmu Komunikasi", "Ilmu Komunikasi", 3),
    ("CTH109", "Aljabar Linear", "Matematika", 3),
    ("CTH110", "Bahasa Indonesia Akademik", "Mata Kuliah Umum", 2),
    ("CTH111", "Struktur Data", "Informatika", 3),
    ("CTH112", "Akuntansi Dasar", "Akuntansi", 3),
]

# key, name, major, cohort, newcomer, bio, (goal, atmosphere, time, style, language)
USERS = [
    (
        "rani",
        "Rani (demo)",
        "Informatika",
        2026,
        True,
        "Akun demo. Baru pindah kota.",
        ("assignment_group", "chill", "evening", "chat_active", "id"),
    ),
    (
        "bima",
        "Bima (demo)",
        "Informatika",
        2026,
        False,
        "Akun demo. Suka belajar bareng.",
        ("exam_prep", "focused", "evening", "chat_light", "mixed"),
    ),
    (
        "sari",
        "Sari (demo)",
        "Matematika",
        2025,
        False,
        "Akun demo.",
        ("concept_discussion", "mixed", "afternoon", "meetup_ready", "id"),
    ),
    (
        "yoga",
        "Yoga (demo)",
        "Statistika",
        2026,
        True,
        "Akun demo.",
        ("just_connect", "chill", "flexible", "chat_active", "mixed"),
    ),
]

# key, course, owner, title, description, goal, atmosphere, time, capacity, members
LOBBIES = [
    (
        "l1",
        "CTH101",
        "rani",
        "Demo: Kelompok tugas besar",
        "Lobby contoh. Cari 3 orang buat ngerjain tugas besar bareng, santai tapi rutin.",
        "assignment_group",
        "chill",
        "evening",
        5,
        ["bima"],
    ),
    (
        "l2",
        "CTH101",
        "bima",
        "Demo: Latihan soal UTS",
        "Lobby contoh. Bahas soal tiap Rabu malam.",
        "exam_prep",
        "focused",
        "evening",
        8,
        ["sari", "yoga"],
    ),
    (
        "l3",
        "CTH101",
        "yoga",
        "Demo: Kenalan dulu aja",
        "Lobby contoh untuk maba dan perantau.",
        "just_connect",
        "chill",
        "flexible",
        10,
        [],
    ),
    (
        "l4",
        "CTH102",
        "sari",
        "Demo: Bedah konsep limit",
        "Lobby contoh. Diskusi materi pelan-pelan.",
        "concept_discussion",
        "mixed",
        "afternoon",
        6,
        ["rani"],
    ),
    (
        "l5",
        "CTH102",
        "bima",
        "Demo: Duo belajar (penuh)",
        "Lobby contoh yang sudah penuh.",
        "exam_prep",
        "focused",
        "morning",
        2,
        ["yoga"],
    ),
    (
        "l6",
        "CTH106",
        "rani",
        "Demo: Proyek basis data",
        "Lobby contoh. Bagi tugas ERD dan query.",
        "assignment_group",
        "mixed",
        "afternoon",
        4,
        ["sari"],
    ),
]

# lobby, sender, body, is_intro
MESSAGES = [
    ("l1", "rani", "Halo! Ini pesan contoh. Aku buka lobby buat tugas besar.", False),
    (
        "l1",
        "bima",
        "Halo, aku Bima (demo), Informatika angkatan 2026. Aku mau belajar bareng "
        "tugas kelompok di mata kuliah ini.",
        True,
    ),
    ("l1", "rani", "Asik, salam kenal! Nanti kita bagi tugasnya di sini ya.", False),
    ("l2", "bima", "Pesan contoh: mulai dari soal rekursi dulu gimana?", False),
    (
        "l2",
        "sari",
        "Halo, aku Sari (demo), Matematika angkatan 2025. Aku mau persiapan ujian.",
        True,
    ),
    ("l2", "yoga", "Boleh, aku ikut. Rabu malam kosong.", False),
    ("l4", "sari", "Pesan contoh: limit kiri dan kanan bikin bingung, yuk dibahas.", False),
    ("l6", "rani", "Pesan contoh: ERD-nya sudah aku coret-coret.", False),
]


def sid(name: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, name)


async def seed(session: AsyncSession, now: datetime, demo: bool = True) -> None:
    semester = await session.scalar(select(Semester).where(Semester.is_active))
    if semester is None:
        semester = Semester(
            id=sid("semester"),
            name="Semester Contoh",
            starts_at=now - timedelta(days=7),
            ends_at=now + timedelta(days=150),
            is_active=True,
        )
        session.add(semester)
    for code, name, dept, credits in COURSES:
        if await session.get(Course, sid(code)) is None:
            session.add(
                Course(
                    id=sid(code),
                    code=code,
                    name=name,
                    faculty_or_dept=dept,
                    credits=credits,
                    is_sample=True,
                )
            )
    await session.flush()
    if not demo:
        await session.commit()
        return

    password_hash = hash_password(DEMO_PASSWORD)
    admin = ("admin", "Admin (demo)", "", None, False, "Akun demo admin.", None)
    for key, name, major, cohort, newcomer, bio, prefs in [*USERS, admin]:
        if await session.get(User, sid(f"user-{key}")) is not None:
            continue
        user = User(
            id=sid(f"user-{key}"),
            email=f"{key}@{DEMO_DOMAIN}",
            password_hash=password_hash,
            display_name=name,
            major=major,
            cohort_year=cohort,
            is_newcomer=newcomer,
            bio=bio,
            role=UserRole.admin if key == "admin" else UserRole.student,
            email_verified_at=now,
            onboarded_at=now,
            code_of_conduct_at=now,
        )
        if prefs is not None:
            goal, atmosphere, time, style, language = prefs
            user.preferences = UserPreferences(
                study_goal=StudyGoal(goal),
                atmosphere=Atmosphere(atmosphere),
                preferred_time=PreferredTime(time),
                communication_style=CommunicationStyle(style),
                language=Language(language),
            )
        session.add(user)
        for code in ("CTH101", "CTH102", "CTH106"):
            session.add(
                UserPlannedCourse(
                    user_id=sid(f"user-{key}"), course_id=sid(code), semester_id=semester.id
                )
            )
    await session.flush()

    for key, course, owner, title, desc, goal, atmosphere, time, capacity, members in LOBBIES:
        if await session.get(Lobby, sid(f"lobby-{key}")) is not None:
            continue
        full = len(members) + 1 >= capacity
        session.add(
            Lobby(
                id=sid(f"lobby-{key}"),
                course_id=sid(course),
                semester_id=semester.id,
                creator_id=sid(f"user-{owner}"),
                title=title,
                description=desc,
                study_goal=StudyGoal(goal),
                atmosphere=Atmosphere(atmosphere),
                preferred_time=PreferredTime(time),
                capacity=capacity,
                status="full" if full else "open",
                expires_at=semester.ends_at,
            )
        )
        await session.flush()
        start = now - timedelta(hours=5)
        for index, member in enumerate([owner, *members]):
            session.add(
                LobbyMember(
                    lobby_id=sid(f"lobby-{key}"),
                    user_id=sid(f"user-{member}"),
                    role=MemberRole.owner if index == 0 else MemberRole.member,
                    joined_at=start + timedelta(minutes=index),
                )
            )
        for index, (_, sender, body, is_intro) in enumerate(m for m in MESSAGES if m[0] == key):
            session.add(
                Message(
                    lobby_id=sid(f"lobby-{key}"),
                    sender_id=sid(f"user-{sender}"),
                    body=body,
                    is_intro=is_intro,
                    created_at=start + timedelta(minutes=10 + index * 3),
                )
            )
    await session.commit()


async def main() -> None:
    """`--courses-only` loads the sample semester and courses without any demo account."""
    demo = "--courses-only" not in sys.argv
    if demo and get_settings().environment == "production":
        raise SystemExit("Refusing to seed demo accounts in production (use --courses-only).")
    async with SessionFactory() as session:
        await seed(session, datetime.now(UTC), demo=demo)
    await engine.dispose()
    print("Seed done (sample courses and demo accounts)." if demo else "Seed done (courses).")


if __name__ == "__main__":
    asyncio.run(main())
