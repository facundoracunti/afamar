"""Safety gates for manual administrative scripts.

This module only parses configuration. It never creates an engine or opens a
database connection.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from sqlalchemy.engine import make_url


class ScriptSafetyError(RuntimeError):
    """Raised when a script target or authorization is unsafe."""


class Operation(str, Enum):
    READ = "read"
    WRITE = "write"
    DDL = "ddl"


class DestinationKind(str, Enum):
    LOCAL_SQLITE = "local-sqlite"
    PRODUCTION_MYSQL = "production-mysql"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class Destination:
    environment: str
    kind: DestinationKind
    driver: str
    host: str | None
    database: str | None

    @property
    def safe_label(self) -> str:
        """Return a destination label that contains no credentials."""
        location = self.database or "<unknown-database>"
        if self.host:
            location = f"{self.host}/{location}"
        return f"{self.environment}:{self.driver}://{location}"


def classify_destination(environment: str, database_url: str) -> Destination:
    """Classify a configured destination without connecting to it.

    Only development/testing SQLite and production MySQL are recognized. Any
    mismatch between the declared environment and URL is deliberately unsafe.
    """
    normalized_environment = environment.strip().lower()
    if normalized_environment not in {"development", "testing", "production"}:
        raise ScriptSafetyError("Unknown execution environment; refusing to continue")

    try:
        parsed = make_url(database_url)
    except Exception as exc:
        raise ScriptSafetyError("Invalid database configuration; refusing to continue") from exc

    driver = parsed.drivername.lower()
    if driver in {"sqlite", "sqlite+pysqlite"}:
        if normalized_environment in {"development", "testing"}:
            return Destination(
                normalized_environment,
                DestinationKind.LOCAL_SQLITE,
                driver,
                None,
                parsed.database,
            )
        raise ScriptSafetyError("Production must not use SQLite for an administrative script")

    if driver in {"mysql", "mysql+pymysql"} and normalized_environment == "production":
        return Destination(
            normalized_environment,
            DestinationKind.PRODUCTION_MYSQL,
            driver,
            parsed.host,
            parsed.database,
        )

    raise ScriptSafetyError("Database target does not match the configured environment")


def require_operation(
    destination: Destination,
    operation: Operation,
    *,
    confirmed: bool = False,
) -> None:
    """Authorize an operation under the administrative-script policy.

    Production is read-only at most in this stage, and reads still require an
    explicit confirmation. Writes and DDL are always blocked there. Local
    writes and DDL require the command-line confirmation flag.
    """
    if destination.kind is DestinationKind.UNKNOWN:
        raise ScriptSafetyError("Unknown database destination; refusing to continue")

    if destination.kind is DestinationKind.PRODUCTION_MYSQL:
        if operation is not Operation.READ:
            raise ScriptSafetyError(
                "Destructive operations on production are disabled for administrative scripts"
            )
        if not confirmed:
            raise ScriptSafetyError(
                "Production reads require explicit confirmation; no data was changed"
            )
        return

    if operation is not Operation.READ and not confirmed:
        raise ScriptSafetyError(
            f"{operation.value} operations on local databases require --confirm"
        )
