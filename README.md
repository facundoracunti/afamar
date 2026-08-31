# AFAMAR-PROJECT
Web informativa, Sistema de gestión de presupuestos, órdenes de trabajo, clientes, materiales y stock para una marmolería.

## PASO 1  
Clonar repositorio:
```bash
git clone https://github.com/facundoracunti/afamar.git
```
Cambiar a al directorio:
```bash
cd afamar
```

## PASO 2  
Renombrar y colocar las variables de entorno:
```bash
cp .env.example .env
nano .env
```

### PASO 3
Crear las imágenes de Docker:
Verificar si existe la red 'infra-net':
```bash
docker network ls | grep infra-net
```
Si no existe, crearla:
```bash
docker network create infra-net
```
Luego:
```bash
docker compose build
```

## PASO 4 
En Dockhand ó Portainer, copiar el siguiente contenido. 
Agregar las variables de entorno que están en el archivo `.env`, o bien adjuntar directamente el archivo.
```yaml
services:
  backend:
    image: afamar-backend:latest
    container_name: afamar-backend
    volumes:
      - afamar-backend_uploads:/afamar-backend/uploads
    environment:
      - TZ=${TZ:-America/Argentina/Buenos_Aires}
      - ENVIRONMENT=${ENVIRONMENT:-production}
      - DB_HOST=${DB_HOST:-mysql-central}
      - DB_PORT=${DB_PORT:-3306}
      - DB_USER=${DB_USER:-afamar-project}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME:-afamar-project}
      - CORS_ALLOW_ORIGINS=${CORS_ALLOW_ORIGINS:-http://afamar-frontend:80}
      - SECRET_KEY=${SECRET_KEY:-afamar-secret-key-change-in-production}
      - ALGORITHM=${ALGORITHM:-HS256}
      - ACCESS_TOKEN_EXPIRE_HOURS=${ACCESS_TOKEN_EXPIRE_HOURS:-2}
      - FRONTEND_URL=${FRONTEND_URL:-http://afamar-frontend:80}
      - DEBUG=${DEBUG:-false}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:3095/api/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    networks:
      - infra-net
    ports:
      - ${API_PORT:-3095}:3095
    restart: unless-stopped

  frontend:
    image: afamar-frontend:latest
    container_name: afamar-frontend
    environment:
      - TZ=${TZ:-America/Argentina/Buenos_Aires}
      - ENVIRONMENT=${ENVIRONMENT:-production}
      - API_URL=${API_URL:-/api/v1}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3090"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    ports:
      - ${WEB_PORT:-3090}:80
    networks:
      - infra-net
    restart: unless-stopped

volumes:
  afamar-backend_uploads:
    name: afamar-backend_uploads

networks:
  infra-net:
    driver: bridge
    name: infra-net
    enable_ipv6: false
    external: true

```

### Opción alternativa para crear el stack

En el directorio raíz se encuentra el archivo `stack-compose.yml`. Podés copiar el contenido y crear el stack directamente:

```bash
cat stack-compose.yml
```

## PASO 5
Ejecutar las migraciones (se corren automáticamente al arrancar el backend, pero podés aplicarlas manualmente):
```bash
# Dockerizado
docker exec -it afamar-backend python -m alembic upgrade head

# Local (desde afamar-backend/)
.\venv\Scripts\python.exe -m alembic upgrade head
```

## PASO 6
Ejecutar el seeder (opcional — **ya no corre automático al levantar el servidor**).
Corré el seeder por separado, modelo por modelo, en este orden (respetá el orden porque hay dependencias entre tablas):

```bash
# Dockerizado — cada seeder en su propio comando
docker exec -it afamar-backend python -m scripts.seed --only settings
docker exec -it afamar-backend python -m scripts.seed --only categories
docker exec -it afamar-backend python -m scripts.seed --only colors
docker exec -it afamar-backend python -m scripts.seed --only pool_types
docker exec -it afamar-backend python -m scripts.seed --only materials
docker exec -it afamar-backend python -m scripts.seed --only pool_stock
docker exec -it afamar-backend python -m scripts.seed --only additional_works
docker exec -it afamar-backend python -m scripts.seed --only payment_methods
docker exec -it afamar-backend python -m scripts.seed --only users
```

Para correrlos todos de una vez en orden (mismo resultado):
```bash
docker exec -it afamar-backend python -m scripts.seed
```

O un subconjunto:
```bash
docker exec -it afamar-backend python -m scripts.seed --only categories,colors,materials
```

> **Local** (desde `afamar-backend/`, con el venv activo) `./venv/Scripts/python.exe -m scripts.seed` seguido de los mismos `--only`/argumentos de arriba. Ejemplo: `.\venv\Scripts\python.exe -m scripts.seed --only users`.
>
> Los seeders son **idempotentes**: se pueden re-ejecutar sin duplicar ni pisar datos manuales.
>
> `--reset-admin-password` fuerza el reseteo de la contraseña del admin.

## Comandos adicionales:
Saber version de DB:
```bash
docker exec -it afamar-backend python -m alembic current
```
Actualizar version de DB:
```bash
docker exec -it afamar-backend python -m alembic upgrade head
```