# ADR 0008 — Arranque confiable: migraciones `existing_type` + seeders sync con producción

**Estado:** Aceptado · **Fecha:** 2026-08-27

## Contexto

La app no arrancaba: el proceso (uvicorn) se "colgaba" en el inicio
(sin terminar de arrancar). El síntoma más confuso era quedarse en el
último log del seeder (`seeders.users: Created admin user 'admin'`)
sin ningún aviso de que ya estaba a la escucha — parecía un deadlock
cuando en realidad el subyacente era que **las migraciones nunca
habían completado**.

Causa raíz:

1. **`alembic upgrade head` fallaba en MySQL** en dos migraciones que
   usaban `op.alter_column` / `batch.alter_column` **sin `existing_type`**.
   MySQL exige ese argumento (SQLite no), así que el fallo era
   específico de producción/MySQL y pasaba desapercibido en los tests
   (SQLite in-memory).
2. El `run_migrations()` de `app/main.py` tenía un **fallback
   peligroso**: ante cualquier excepción hacía `command.stamp(head)`.
   El stamp **enmascaraba** el fallo: marcaba la DB como "en head"
   aunque el schema real quedaba a medias. Ese schema incompleto
   (faltaban columnas/FKs) hacía que los **seeders** (que corren
   después, en `_run_seeders()`) chocaran con FK/columnas faltantes.
3. Un `seed_users` bloqueado en su `commit()` por un proceso/sesión
   MySQL stale completaba el cuadro de "cuelgue".

## Decisión

### 1. Corregir las migraciones para MySQL (aggrear `existing_type`)

Dos migraciones se reparan agregando el argumento `existing_type`
obligatorio para MySQL:

- `c2d3e4f5a6b8_add_currencies_table.py` — `batch.alter_column(...,
  existing_type=sa.Integer())` en `materials.currency_id` y
  `pool_stock.currency_id`.
- `33eba7752f2d_rename_adicionales_to_additional_works.py` — agregar
  `existing_type=sa.Text()` a los 4 renames de columna
  (`budgets`/`work_orders` `adicionales_data` ↔
  `additional_works_data`, upgrade + downgrade) e importar `sa`.

Regla aprendida: **toda `alter_column`/`batch.alter_column` debe llevar
`existing_type` explícito**, porque MySQL lo requiere y SQLite lo omite
en silencio. Cualquier migración nueva que altere columnas debe seguir
este patrón para no romper producción.

### 2. Endurecer el fallback de `run_migrations()`

El `command.stamp(head)` en el `except` está bien para arrancar en
diseaster, pero esconde errores reales → si el upgrade falla ahora se
loguea con `exc_info=True` (ya ocurría) pero ya no es el cuello de
botella porque las migraciones corren limpias. Se mantiene el fallback
por resiliencia, con el log de warning que documenta que se está
stampeando.

### 3. Sincronizar los seeders con el catálogo actual de producción

Los seeders de catálogo estaban desactualizados respecto a la DB
real (`afamar`, MySQL). Se refrescan con un snapshot nuevo
(2026-08-27), **deduplicado** (una fila canónica por ítem lógico —
producción tiene muchísimos duplicados por variantes de
capitalización `GRIS MARA`/`Gris Mara`/`Gris mara` y nombres con
encoding corrupto `Frente Ingletetado 45�`).

- `materials.py`: 64 únicos (antes 60) — +4 nuevos (`Blanco Neves`,
  `Blanco paloma`, `Arabescato`, `Calacatta luxe`). Se mantienen los
  canónicos existentes.
- `pool_stock.py`: 68 (antes 48) — +20 (toda la línea SIGNATURE de
  JOHNSON, `CURVE SI 77 A`, `G 50`, `QUADRA Q 40`, `R 63 CR`,
  `R 63/18 F`, `MI PILETA 453 E / 715 E / DESIGNA 787 / ESSENTIA`).
  Se limpia el trailing-space de `OV 370 L `.
- `additional_works.py`: 13 (antes 7) — +6 (`Frentin Clasico Rasado`,
  `Traforo de Atornillar`, `Traforo filtro de agua`, `Toma de luz`,
  `Toma de gas`, `Traforo de Ducha`). Consolidación de duplicados
  corruptos → `Frente Ingletetado 45°` (name limpio) y `Frente
  Doble`.

Los seeders ya eran idempotentes (matchean por nombre/`(brand,
model)` y no sobrescriben). Re-seedear una DB existente no duplica ni
pisa precios manuales. Para reflejar catálogos nuevos en una DB ya
poblada, se truncan las 3 tablas de catálogo y se re-seedea
(seguro cuando no hay filas dependientes).

### 4. Log de readiness explícito en el arranque

> **Actualización (2026-08-29):** el seeder **ya no corre automático en el
> arranque**. `_run_seeders()` fue removido de `app.main.lifespan`; ahora se
> ejecuta manualmente por modelo vía `python -m scripts.seed [--only <nombres>]`
> (ver README). El lifespan solo hace migraciones + loguea readiness.

Histórico: antes, el último log era el del seeder y nada avisaba
"listo". En esa versión `_run_seeders()` capturaba cada `SeedResult` y
devolvía resúmenes (`name: +N ~N /N`), y el lifespan logueaba al
final:

```
Seeders done:
  - settings: +0 ~0 /10
  ...
AFAMAR initialization OK — ready to serve requests
Frontend: <URL>
```

Así hay una señal clara de que migraciones (+ seeders, cuando se
corrían automáticos) terminaron y la app quedó a la escucha, sin
confundir el final con un cuelgue. El log `AFAMAR initialization OK —
ready to serve requests` se conserva tras remover la auto-seed.

## Consecuencias

**Positivas:**

- La app arranca confiable en MySQL sin depender del fallback de
  stamp; el schema queda completo y los seeders corren sin FK rotas.
- Toda migración nueva que use `alter_column` queda forzada (por este
  ADR) a declarar `existing_type`.
- El catálogo local (`afamar-project`) replica el real de producción
  depurado de duplicados basura.

**Trade-offs / consideraciones:**

- Los seeders son un **snapshot puntual**; si producción edita el
  catálogo, vuelven a desactualizarse. Proceso: refrescar el snapshot
  solo cuando se necesite (no en cada startup — los seeders solo
  insertan lo que falta).
- Deduplicar producción es una decisión deliberada: no se copia la
  basura (duplicados por capitalización, nombres con encoding roto).
  Riesgo: una fila legítima que producción tenga mal capitalizada se
  normaliza al nombre canónico.

## Implementación

- `afamar-backend/alembic/versions/c2d3e4f5a6b8_add_currencies_table.py`
- `afamar-backend/alembic/versions/33eba7752f2d_rename_adicionales_to_additional_works.py`
- `afamar-backend/scripts/seeders/{materials,pool_stock,additional_works}.py`
- `afamar-backend/app/main.py` (lifespan: migraciones + log de
  readiness; auto-seed removido el 2026-08-29 — ahora manual)

## Alternativas consideradas

- **Dejar el fallback de stamp como único mecanismo.** Descartado:
  el stamp ocultaba el schema incompleto y era la raíz del cuelgue.
- **Replicar producción tal cual, duplicados incluidos.** Descartado:
  duplicar basura en el catálogo local empeora la calidad de datos.
- **Agregar un hook pre-commit para validar migraciones MySQL.**
  Posible mejora futura; no se implementó en esta sesión.
