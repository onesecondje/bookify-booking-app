CREATE TABLE businesses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CONSTRAINT businesses_name_not_blank CHECK (length(btrim(name)) > 0),
    time_zone text NOT NULL CONSTRAINT businesses_time_zone_not_blank CHECK (length(btrim(time_zone)) > 0),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    name text NOT NULL CONSTRAINT services_name_not_blank CHECK (length(btrim(name)) > 0),
    duration_minutes integer NOT NULL CONSTRAINT services_duration_positive CHECK (duration_minutes > 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL does not automatically index the referencing side of a foreign key.
CREATE INDEX services_business_id_idx ON services (business_id);
