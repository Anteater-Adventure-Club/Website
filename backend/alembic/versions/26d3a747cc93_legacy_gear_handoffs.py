"""Keep custody consistent while earlier API instances are still serving handoffs."""

from alembic import op

revision = "26d3a747cc93"
down_revision = "15c29636bb82"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("SELECT pg_advisory_xact_lock(759)")
    # Old writers know the handing officer and model but cannot supply a copy number.
    op.execute("""
        CREATE FUNCTION gear_number_legacy_pickup() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            PERFORM pg_advisory_xact_lock(759);
            SELECT n INTO NEW.copy_number
            FROM gear_items i CROSS JOIN LATERAL generate_series(1, i.quantity) AS copies(n)
            LEFT JOIN gear_custodians c ON c.item_id = i.id AND c.copy_number = n
            WHERE i.id = NEW.item_id AND NOT EXISTS (
                SELECT 1 FROM gear_lines l WHERE l.item_id = i.id
                AND l.status = 'picked_up' AND l.copy_number = n
            )
            ORDER BY CASE WHEN c.officer_id = NEW.picked_up_by THEN 0
                          WHEN c.officer_id IS NULL THEN 1 ELSE 2 END, n
            LIMIT 1;
            IF NEW.copy_number IS NULL THEN
                RAISE EXCEPTION 'No copy available for pickup' USING ERRCODE = '23514';
            END IF;
            DELETE FROM gear_custodians WHERE item_id = NEW.item_id AND copy_number = NEW.copy_number;
            UPDATE gear_items SET revision = revision + 1 WHERE id = NEW.item_id;
            RETURN NEW;
        END $$;
        CREATE TRIGGER gear_number_legacy_pickup BEFORE INSERT OR UPDATE OF status, copy_number ON gear_lines
        FOR EACH ROW WHEN (NEW.status = 'picked_up' AND NEW.copy_number IS NULL)
        EXECUTE FUNCTION gear_number_legacy_pickup();
    """)
    op.execute("UPDATE gear_lines SET copy_number = NULL WHERE status = 'picked_up' AND copy_number IS NULL")
    op.create_check_constraint("ck_gear_checked_out_copy", "gear_lines",
                               "status <> 'picked_up' OR copy_number IS NOT NULL")
    # Earlier versions record the return but have no receiving-custodian field. Those copies become Unknown.
    op.execute("""
        CREATE FUNCTION gear_return_revision() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            UPDATE gear_items SET revision = revision + 1 WHERE id = NEW.item_id;
            RETURN NEW;
        END $$;
        CREATE TRIGGER gear_return_revision AFTER UPDATE OF status ON gear_lines
        FOR EACH ROW WHEN (OLD.status = 'picked_up' AND NEW.status = 'returned')
        EXECUTE FUNCTION gear_return_revision();
    """)
    op.execute("""
        CREATE FUNCTION gear_protect_held_copies() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF EXISTS (SELECT 1 FROM gear_custodians WHERE item_id = NEW.id AND copy_number > NEW.quantity)
            OR EXISTS (SELECT 1 FROM gear_lines WHERE item_id = NEW.id AND status = 'picked_up'
                       AND copy_number > NEW.quantity) THEN
                RAISE EXCEPTION 'Quantity would remove a held copy' USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
        END $$;
        CREATE TRIGGER gear_protect_held_copies BEFORE UPDATE OF quantity ON gear_items
        FOR EACH ROW WHEN (NEW.quantity < OLD.quantity) EXECUTE FUNCTION gear_protect_held_copies();
    """)


def downgrade():
    op.drop_constraint("ck_gear_checked_out_copy", "gear_lines", type_="check")
    for name, table in (("gear_protect_held_copies", "gear_items"), ("gear_return_revision", "gear_lines"),
                        ("gear_number_legacy_pickup", "gear_lines")):
        op.execute(f"DROP TRIGGER {name} ON {table}")
        op.execute(f"DROP FUNCTION {name}()")
