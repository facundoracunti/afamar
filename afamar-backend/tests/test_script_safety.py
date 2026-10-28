import importlib
import sys

import pytest

from scripts.safety import (
    DestinationKind,
    Operation,
    ScriptSafetyError,
    classify_destination,
    require_operation,
)


def test_classifies_local_sqlite_destinations():
    development = classify_destination("development", "sqlite:///afamar.db")
    testing = classify_destination("testing", "sqlite:///C:/Temp/afamar_test.db")

    assert development.kind is DestinationKind.LOCAL_SQLITE
    assert testing.kind is DestinationKind.LOCAL_SQLITE


def test_classifies_production_mysql_without_exposing_credentials():
    destination = classify_destination(
        "production",
        "mysql+pymysql://admin:super-secret@mysql-host:3306/afamar",
    )

    assert destination.kind is DestinationKind.PRODUCTION_MYSQL
    assert "super-secret" not in destination.safe_label
    assert "admin" not in destination.safe_label
    assert destination.safe_label == "production:mysql+pymysql://mysql-host/afamar"


@pytest.mark.parametrize(
    ("environment", "url"),
    [
        ("staging", "sqlite:///staging.db"),
        ("development", "mysql+pymysql://user:secret@host/db"),
        ("production", "sqlite:///afamar.db"),
        ("development", "postgresql://user:secret@host/db"),
        ("development", "sqlite+unexpected:///afamar.db"),
        ("production", "mysql+unexpected://user:secret@host/db"),
    ],
)
def test_rejects_unknown_or_mismatched_destinations(environment, url):
    with pytest.raises(ScriptSafetyError):
        classify_destination(environment, url)


def test_blocks_production_writes_and_ddl_even_when_confirmed():
    destination = classify_destination("production", "mysql+pymysql://user:secret@host/afamar")

    for operation in (Operation.WRITE, Operation.DDL):
        with pytest.raises(ScriptSafetyError, match="production"):
            require_operation(destination, operation, confirmed=True)


def test_requires_explicit_confirmation_for_production_reads():
    destination = classify_destination("production", "mysql+pymysql://user:secret@host/afamar")

    with pytest.raises(ScriptSafetyError):
        require_operation(destination, Operation.READ)

    require_operation(destination, Operation.READ, confirmed=True)


def test_requires_explicit_confirmation_for_local_writes_and_ddl():
    destination = classify_destination("development", "sqlite:///afamar.db")

    for operation in (Operation.WRITE, Operation.DDL):
        with pytest.raises(ScriptSafetyError, match="--confirm"):
            require_operation(destination, operation)
        require_operation(destination, operation, confirmed=True)


def test_importing_historical_scripts_has_no_side_effects(monkeypatch):
    import urllib.request

    import pymysql

    def fail(*_args, **_kwargs):
        raise AssertionError("historical script performed an operation during import")

    monkeypatch.setattr(pymysql, "connect", fail)
    monkeypatch.setattr(urllib.request, "urlopen", fail)

    for module_name in ("final_ground_truth", "temp_final_state_check"):
        sys.modules.pop(module_name, None)
        module = importlib.import_module(module_name)
        assert not hasattr(module, "api")


def test_apply_color_backfill_rejects_production_before_session_creation(monkeypatch):
    module = importlib.import_module("scripts.apply_color_backfill")
    monkeypatch.setattr(module.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(sys, "argv", ["apply_color_backfill.py", "--confirm"])

    def fail_session():
        raise AssertionError("SessionLocal was reached before the safety gate")

    monkeypatch.setattr(module, "SessionLocal", fail_session)

    with pytest.raises(ScriptSafetyError):
        module.main()


def test_migrate_old_data_rejects_production_before_engine_creation(monkeypatch):
    module = importlib.import_module("tests.migrate_old_data")
    monkeypatch.setattr(sys, "argv", ["migrate_old_data.py"])

    def fail_engine(*_args, **_kwargs):
        raise AssertionError("create_engine was reached before the safety gate")

    monkeypatch.setattr(module, "create_engine", fail_engine)

    with pytest.raises(ScriptSafetyError):
        module.main()


def test_drop_old_is_blocked_on_production_even_with_confirmation(monkeypatch):
    module = importlib.import_module("tests.migrate_old_data")
    monkeypatch.setattr(sys, "argv", ["migrate_old_data.py", "--drop-old", "--confirm"])

    with pytest.raises(ScriptSafetyError):
        module.main()


def test_migrate_old_data_restores_environment_after_success_and_failure(monkeypatch):
    module = importlib.import_module("tests.migrate_old_data")
    original_environment = module.settings.ENVIRONMENT
    monkeypatch.setattr(sys, "argv", ["migrate_old_data.py", "--env", "development"])

    def successful_run():
        module.settings.ENVIRONMENT = "production"
        return 0

    monkeypatch.setattr(module, "_main", successful_run)
    assert module.main() == 0
    assert module.settings.ENVIRONMENT == original_environment

    def failed_run():
        module.settings.ENVIRONMENT = "production"
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(module, "_main", failed_run)
    with pytest.raises(RuntimeError, match="synthetic failure"):
        module.main()
    assert module.settings.ENVIRONMENT == original_environment


def test_backend_import_remains_available():
    main_module = importlib.import_module("app.main")
    assert main_module.app is not None
