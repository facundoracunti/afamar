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
```bash
- Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate      # Windows

- Instalar dependencias
pip install -r requirements.txt

- Ejecución del servidor
uvicorn app.main:app --reload --port 3095

- Swagger UI
http://127.0.0.1:3095/docs