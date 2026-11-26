from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import exists, func, or_, select

from app.deps import CurrentUser, Db
from app.errors import not_found
from app.models import Course, Lobby, User, UserPlannedCourse
from app.schemas import Ok
from app.schemas_lobby import CourseOut, SemesterOut
from app.services.blocks import blocked_ids
from app.services.lobbies import accessible_to, active_semester, ensure_planned, unread_counts

router = APIRouter(tags=["courses"])


async def _courses(
    db: Db,
    user: User,
    *,
    q: str = "",
    planned_only: bool = False,
    course_id: uuid.UUID | None = None,
) -> list[CourseOut]:
    semester = await active_semester(db)
    planned = exists().where(
        UserPlannedCourse.course_id == Course.id,
        UserPlannedCourse.user_id == user.id,
        UserPlannedCourse.semester_id == semester.id,
    )
    query = select(Course, planned.label("planned")).order_by(Course.code).limit(60)
    if q:
        pattern = f"%{q.replace('%', '').replace('_', '')}%"
        query = query.where(
            or_(
                Course.name.ilike(pattern),
                Course.code.ilike(pattern),
                Course.faculty_or_dept.ilike(pattern),
            )
        )
    if planned_only:
        query = query.where(planned)
    if course_id:
        query = query.where(Course.id == course_id)
    rows = (await db.execute(query)).all()
    ids = [row[0].id for row in rows]
    counts = {
        row[0]: row[1]
        for row in await db.execute(
            select(Lobby.course_id, func.count())
            .where(
                Lobby.course_id.in_(ids),
                Lobby.semester_id == semester.id,
                accessible_to(user.id),
            )
            .group_by(Lobby.course_id)
        )
    }
    planners = {
        row[0]: row[1]
        for row in await db.execute(
            select(UserPlannedCourse.course_id, func.count())
            .where(
                UserPlannedCourse.course_id.in_(ids),
                UserPlannedCourse.semester_id == semester.id,
            )
            .group_by(UserPlannedCourse.course_id)
        )
    }
    unread = await unread_counts(db, user.id, await blocked_ids(db, user.id))
    lobby_course = {
        row[0]: row[1]
        for row in await db.execute(
            select(Lobby.id, Lobby.course_id).where(Lobby.id.in_(unread.keys()))
        )
    }
    per_course: dict[uuid.UUID, int] = {}
    for lobby_id, count in unread.items():
        key = lobby_course[lobby_id]
        per_course[key] = per_course.get(key, 0) + count
    return [
        CourseOut(
            id=course.id,
            code=course.code,
            name=course.name,
            faculty_or_dept=course.faculty_or_dept,
            credits=course.credits,
            is_sample=course.is_sample,
            is_planned=is_planned,
            lobby_count=counts.get(course.id, 0),
            planner_count=planners.get(course.id, 0),
            unread_count=per_course.get(course.id, 0),
        )
        for course, is_planned in rows
    ]


@router.get("/semesters/active")
async def get_active_semester(_: CurrentUser, db: Db) -> SemesterOut:
    return SemesterOut.model_validate(await active_semester(db))


@router.get("/courses")
async def list_courses(
    user: CurrentUser, db: Db, q: Annotated[str, Query(max_length=80)] = "", planned: bool = False
) -> list[CourseOut]:
    return await _courses(db, user, q=q.strip(), planned_only=planned)


@router.get("/courses/{course_id}")
async def get_course(course_id: uuid.UUID, user: CurrentUser, db: Db) -> CourseOut:
    found = await _courses(db, user, course_id=course_id)
    if not found:
        raise not_found("Mata kuliah tidak ditemukan.")
    return found[0]


@router.post("/courses/{course_id}/plan")
async def plan_course(course_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    if await db.get(Course, course_id) is None:
        raise not_found("Mata kuliah tidak ditemukan.")
    semester = await active_semester(db)
    await ensure_planned(db, user.id, course_id, semester.id)
    await db.commit()
    return Ok()


@router.delete("/courses/{course_id}/plan")
async def unplan_course(course_id: uuid.UUID, user: CurrentUser, db: Db) -> Ok:
    semester = await active_semester(db)
    row = await db.get(UserPlannedCourse, (user.id, course_id, semester.id))
    if row is not None:
        await db.delete(row)
        await db.commit()
    return Ok()
