## AFAMAR - backend

API REST desarrollada con **FastAPI**, conectada a una base de datos **MySql**, utilizando:
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