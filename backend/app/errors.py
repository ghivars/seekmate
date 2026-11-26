"""Uniform API errors: {"code": "...", "message": "..."} with Indonesian messages."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self, status: int, code: str, message: str, headers: dict[str, str] | None = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers


def not_found(message: str = "Data tidak ditemukan.") -> AppError:
    return AppError(404, "not_found", message)


def forbidden(message: str = "Kamu tidak punya akses untuk ini.") -> AppError:
    return AppError(403, "forbidden", message)


def conflict(code: str, message: str) -> AppError:
    return AppError(409, code, message)


def invalid(code: str, message: str) -> AppError:
    return AppError(422, code, message)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            {"code": exc.code, "message": exc.message}, exc.status, headers=exc.headers
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            jsonable_encoder(
                {"code": "validation_error", "message": "Periksa lagi isianmu.", "fields": fields}
            ),
            422,
        )
