"""Add crypto payment processor and organization crypto settings

Revision ID: 80ba6e96fd0b
Revises: 37627db663e9
Create Date: 2026-01-31 01:33:12.619765

"""

import sqlalchemy as sa
from alembic import op

# Polar Custom Imports

# revision identifiers, used by Alembic.
revision = "80ba6e96fd0b"
down_revision = "37627db663e9"
branch_labels: tuple[str] | None = None
depends_on: tuple[str] | None = None


def upgrade() -> None:
    # Add crypto_settings column to organizations table
    op.add_column(
        "organizations",
        sa.Column(
            "crypto_settings",
            sa.dialects.postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    
    # Set default value for existing rows
    op.execute(
        """
        UPDATE organizations
        SET crypto_settings = '{"enabled": false}'::jsonb
        WHERE crypto_settings IS NULL
        """
    )
    
    # Make the column NOT NULL
    op.alter_column("organizations", "crypto_settings", nullable=False)
    
    # Revoke any column-level grants and grant full table SELECT to polar_read
    op.execute("REVOKE ALL ON organizations FROM polar_read")
    op.execute("GRANT SELECT ON organizations TO polar_read")


def downgrade() -> None:
    # Drop crypto_settings column from organizations table
    op.drop_column("organizations", "crypto_settings")
