from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from db.session import SessionLocal
from sql import load_stored_procedures
from utils.exceptions import AppError
from utils.logger import get_logger
from api.routes import auth as auth_router
from api.routes import admin as admin_router
from api.routes import businesses as businesses_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — loading stored procedures")
    db = SessionLocal()
    try:
        load_stored_procedures(db)
        logger.info("Stored procedures loaded successfully")
    except Exception:
        logger.exception("Failed to load stored procedures on startup")
    finally:
        db.close()
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="AdGen Agentic API",
    version="0.1.0",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handlers ─────────────────────────────────────────────────

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.warning(
        "AppError [%s] on %s %s — %s",
        exc.error_code, request.method, request.url.path, exc.message,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error_code, "message": exc.message, "detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"field": ".".join(str(l) for l in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    logger.warning("Validation error on %s %s — %s", request.method, request.url.path, errors)
    return JSONResponse(
        status_code=422,
        content={"error": "VALIDATION_ERROR", "message": "Request validation failed", "detail": errors},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred", "detail": None},
    )

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(admin_router.router, prefix="/api/v1")
app.include_router(businesses_router.router, prefix="/api/v1")
