from app.repositories.search import contains_pattern, escape_like


def test_like_wildcards_are_escaped():
    assert escape_like(r"100%_a\b") == r"100\%\_a\\b"
    assert contains_pattern("x_y") == r"%x\_y%"
