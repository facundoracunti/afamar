## AFAMAR - backend

API REST desarrollada con **FastAPI**, usando **SQLite en localhost** y **MySQL en producción**,
utilizando:
**SQLAlchemy** como ORM.
**Alembic** para migraciones.  
**Pydantic** para validaciones.

## ⚙️ Requisitos

- Python 3.12+
- MySql
- pipenv o virtualenv (recomendado)
- Alembic
- Docker & Docker Compose (recommended)

### Development Setup

#### ⚠️ Configuración de Variables de Entorno
Antes de iniciar la aplicación, **debes configurar tu archivo `.env`**:
```bash
cp .env.example .env
```

### Perfiles de base de datos

- **Localhost:** `ENVIRONMENT=development`. Usa la SQLite ubicada en
  `afamar-backend/afamar.db`, independientemente de la carpeta desde la que se
  inicia Uvicorn.
- **Frosty/producción:** `ENVIRONMENT=production`. Usa el MySQL configurado por
  `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. El entorno local no debe
  apuntar a la base operativa de Frosty.

## 📦 Instalación y ▶️ Ejecución del servidor
- Crear y activar entorno virtual
```bash
python -m venv venv
venv\Scripts\activate
```

- Instalar dependencias
```bash
pip install -r requirements.txt
```

- Ejecución del servidor
```bash
uvicorn app.main:app --reload --port 3095
```

- Swagger UI
http://127.0.0.1:3095/docs


# los containers están healthy
docker compose ps
# esperás: "(healthy)" en ambas filas

# chequeo de Alembic — la última migración aplicada debe ser r8s9t0u1v2w3
docker compose exec afamar-backend alembic current
# esperás: r8s9t0u1v2w3 (head)

# chequeo del seed — los 4 métodos están en la DB
docker compose exec afamar-backend python -c "
from app.db.session import SessionLocal
from app.models.reference import PaymentMethod
db = SessionLocal()
for pm in db.query(PaymentMethod).order_by(PaymentMethod.sort_order).all():
    print(pm.name, '|', pm.type, '|', pm.value, '|', pm.is_percentage, '|', pm.applies_to_installments)
db.close()
"
# esperás: las 4 filas en español


## 🌱 Seeders (por modelo, manual)

El seeder **ya no corre automático al levantar el servidor**. Se ejecuta a mano,
por modelo, con `scripts.seed`. Cada modelo tiene su propio seeder en
`scripts/seeders/` y se invoca con `--only <nombre>`. Son **idempotentes**
(re-ejecutables sin duplicar ni pisar datos manuales).

Orden recomendado (respetá las dependencias entre tablas):

| Orden | Seeder | Depende de |
|---|---|---|
| 1 | `settings` | — |
| 2 | `categories` | — |
| 3 | `colors` | — |
| 4 | `pool_types` | — |
| 5 | `materials` | categories + colors |
| 6 | `pool_stock` | pool_types + materials |
| 7 | `additional_works` | — |
| 8 | `payment_methods` | — |
| 9 | `users` | — |

- Correr todo en orden (mismo resultado que uno por uno):
```bash
# Local
.\venv\Scripts\python.exe -m scripts.seed
# Dockerizado
docker exec -it afamar-backend python -m scripts.seed
```

- Un seeder individual:
```bash
# Local
.\venv\Scripts\python.exe -m scripts.seed --only materials
# Dockerizado
docker exec -it afamar-backend python -m scripts.seed --only materials
```

- Un subconjunto / resetear la contraseña del admin:
```bash
.\venv\Scripts\python.exe -m scripts.seed --only categories,colors,materials
.\venv\Scripts\python.exe -m scripts.seed --only users --reset-admin-password
```


# Dry-run (solo reporte)
- Local
```bash
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py
```
- Dockerizado
```bash
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py
```
# Fix automático
- Local
```bash
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix
```
- Dockerizado
```bash
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py --fix
```

# Fix interactivo (confirma cada uno)
- Local
```bash
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix --interactive
```
- Dockerizado
```bash
docker exec -it afamar-backend python scripts/fix_corrupt_work_orders.py --fix --interactive
```
