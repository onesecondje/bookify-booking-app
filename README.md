# Bookify

A Booksy-style application for booking service appointments.

## Project structure

- `frontend/`: Next.js and React application (currently the starter page).
- `backend/`: Express and TypeScript API. See [backend documentation](backend/README.md).
- `compose.yaml`: local PostgreSQL development environment.

PostgreSQL runs in Docker. The frontend and backend currently run directly on
the host. The backend is not connected to the database yet, and no application
tables have been created.

## Requirements

- Node.js 24 or newer and pnpm for the applications.
- Docker Desktop with a running Linux container engine and Docker Compose.

## Start the database

Run commands from the repository root. On first setup, create a local configuration
file in PowerShell:

```powershell
Copy-Item .env.example .env
```

Do not overwrite an existing `.env`. Edit its values as needed. The example
password is for local development only. The actual `.env` file is ignored by Git.

```sh
docker compose config --quiet
docker compose up -d --wait postgres
docker compose ps
```

The first startup downloads the official `postgres:18` image and initializes the
database. `--wait` waits for the health check to succeed. The port is published on
`127.0.0.1` so the database is accessible from this computer only.

Default connection settings:

| Setting | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `5432` (or `POSTGRES_PORT` from `.env`) |
| Database | `bookify` (or `POSTGRES_DB`) |
| User | `bookify` (or `POSTGRES_USER`) |
| Password | `POSTGRES_PASSWORD` from the local `.env` |

These settings are for local development. The image creates its initial user with
administrative privileges; a production application should use a dedicated role
with only the permissions it needs.

## Verify the database

Run a SQL query using the `psql` client already included in the container:

```sh
docker compose exec postgres psql -U bookify -d bookify -c 'SELECT current_database(), current_user, 1 AS connection_check;'
```

To open an interactive SQL session:

```sh
docker compose exec postgres psql -U bookify -d bookify
```

These commands use the default database and user names; adjust `-U` and `-d` if
you changed them in `.env`. Exit `psql` with `\q`. Check readiness and logs with:

```sh
docker compose ps
docker compose logs --tail=50 postgres
```

The health check uses `pg_isready` to check whether PostgreSQL accepts connections.
It does not verify the application's tables or password authentication. The SQL
commands above run inside the container using a local socket; host connections
use TCP and password authentication.

## Containers and persistent data

The image is the PostgreSQL software template. A container is its running instance.
The named volume `postgres_data` holds database files independently of the container.
For PostgreSQL 18, the volume mounts at `/var/lib/postgresql`.

```sh
docker compose stop postgres
docker compose start postgres
```

To remove the project containers and network while retaining database data:

```sh
docker compose down
```

Run `docker compose up -d --wait postgres` to recreate the container with the same
data. `docker compose down --volumes` also deletes the database volume and its data;
do not use it for routine shutdown.

The image's `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` settings initialize
an empty data directory only. Changing `.env` after initialization does not rename
an existing database, change its roles, or reset its password.

## Environment files

- Root `.env`: configuration read by Docker Compose.
- `backend/.env`: configuration loaded by the backend development command.

They are separate files with separate consumers. Compose reads the root `.env`
for variable substitution; the service's `environment` section selects which
values enter the container. It does not pass these values to the host Node.js
process. Backend database configuration will be added when the API is connected.
