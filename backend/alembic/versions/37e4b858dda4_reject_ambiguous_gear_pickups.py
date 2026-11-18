"""Require a copy number when a legacy handoff has multiple possible custodians."""

from alembic import op

revision = "37e4b858dda4"
down_revision = "26d3a747cc93"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("SELECT pg_advisory_xact_lock(759)")
    op.execute("""
        CREATE OR REPLACE FUNCTION gear_number_legacy_pickup() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
            available integer;
        BEGIN
            PERFORM pg_advisory_xact_lock(759);
            SELECT i.quantity - (SELECT count(*) FROM gear_lines l WHERE l.item_id = i.id
                                 AND l.status = 'picked_up' AND l.copy_number IS NOT NULL)
            INTO available FROM gear_items i WHERE i.id = NEW.item_id;
            IF available > 1 AND EXISTS (SELECT 1 FROM gear_custodians WHERE item_id = NEW.item_id) THEN
                RAISE EXCEPTION 'Select the numbered copy in the updated gear tools' USING ERRCODE = '23514';
            END IF;
            SELECT n INTO NEW.copy_number
            FROM gear_items i CROSS JOIN LATERAL generate_series(1, i.quantity) AS copies(n)
            WHERE i.id = NEW.item_id AND NOT EXISTS (
                SELECT 1 FROM gear_lines l WHERE l.item_id = i.id
                AND l.status = 'picked_up' AND l.copy_number = n
            )
            ORDER BY n LIMIT 1;
            IF NEW.copy_number IS NULL THEN
                RAISE EXCEPTION 'No copy available for pickup' USING ERRCODE = '23514';
            END IF;
            DELETE FROM gear_custodians WHERE item_id = NEW.item_id AND copy_number = NEW.copy_number;
            UPDATE gear_items SET revision = revision + 1 WHERE id = NEW.item_id;
            RETURN NEW;
        END $$;
    """)


def downgrade():
    op.execute("SELECT pg_advisory_xact_lock(759)")
    op.execute("""
        CREATE OR REPLACE FUNCTION gear_number_legacy_pickup() RETURNS trigger LANGUAGE plpgsql AS $$
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
    """)
