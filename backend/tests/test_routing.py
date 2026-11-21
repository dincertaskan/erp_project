from unittest.mock import MagicMock

from sqlalchemy.orm import Session

from app.core.routing import release_sessions


def test_open_read_transaction_is_closed_when_the_endpoint_returns():
    session = MagicMock(spec=Session)
    session.in_transaction.return_value = True

    @release_sessions
    def endpoint(item_id: int, db: Session):
        return {"id": item_id}

    assert endpoint(item_id=3, db=session) == {"id": 3}
    session.commit.assert_called_once()


def test_wrapper_keeps_the_signature_for_dependency_injection():
    import inspect

    def endpoint(item_id: int, db: Session) -> dict:
        return {}

    assert list(inspect.signature(release_sessions(endpoint)).parameters) == ["item_id", "db"]
