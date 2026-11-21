from app.benchmarks.indexes import QUERIES, explain, load_indexes, parameters


def test_index_list_comes_from_the_migration():
    names = {name for name, _, _ in load_indexes()}

    assert "ix_orders_created_at" in names
    assert len(names) == 9


def test_every_benchmark_query_runs(db, customer, make_product):
    conn = db.connection()
    params = parameters(conn)

    for name, sql in QUERIES.items():
        execution, planning, _, _ = explain(conn, sql, params)
        assert execution >= 0 and planning >= 0, name
