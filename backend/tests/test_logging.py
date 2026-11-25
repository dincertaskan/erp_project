import logging

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.logging import HANDLER_NAME, configure_logging
from app.main import app


def test_logging_level_comes_from_env_and_handler_is_added_once(monkeypatch):
    logger = logging.getLogger("app")
    monkeypatch.setattr(logger, "level", logger.level)
    monkeypatch.setenv("LOG_LEVEL", "debug")

    configure_logging()
    configure_logging()

    assert logger.level == logging.DEBUG
    assert [h.get_name() for h in logger.handlers].count(HANDLER_NAME) == 1


def test_invalid_log_level_falls_back_to_info(monkeypatch):
    logger = logging.getLogger("app")
    monkeypatch.setattr(logger, "level", logger.level)
    monkeypatch.setenv("LOG_LEVEL", "verbose")

    configure_logging()

    assert logger.level == logging.INFO


def test_startup_warns_when_stock_locking_is_disabled(monkeypatch, caplog):
    monkeypatch.setattr(settings, "STOCK_STRATEGY", "none")

    with caplog.at_level(logging.WARNING, logger="app"), TestClient(app):
        pass

    assert any(r.levelno == logging.WARNING and "STOCK_STRATEGY=none" in r.getMessage() for r in caplog.records)


def test_startup_is_quiet_with_default_strategy(monkeypatch, caplog):
    monkeypatch.setattr(settings, "STOCK_STRATEGY", "pessimistic")

    with caplog.at_level(logging.WARNING, logger="app"), TestClient(app):
        pass

    assert not [r for r in caplog.records if "STOCK_STRATEGY" in r.getMessage()]
