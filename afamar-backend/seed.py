import requests, json

BASE = "http://localhost:8000/api"

def post(path, data):
    r = requests.post(f"{BASE}{path}", json=data)
    print(f"POST {path} -> {r.status_code}: {r.json().get('nombre') or r.json().get('marca') or r.json().get('numero') or 'OK'}")
    return r.json()

def post_list(path, items):
    for item in items:
        post(path, item)

# Materiales
materiales = [
    {"nombre": "Negro Boreal", "categoria": "Granitos", "color": "Negro", "espesor_disponible": "2 cm", "precio_m2": 240000, "precio_m2_usd": 200, "moneda": "ARS", "proveedor": "Marmolera SA", "stock_disponible": 50},
    {"nombre": "Blanco Norte", "categoria": "Granitos", "color": "Blanco", "espesor_disponible": "2 cm", "precio_m2": 180000, "precio_m2_usd": 150, "moneda": "ARS", "proveedor": "Marmolera SA", "stock_disponible": 30},
    {"nombre": "Gris Mara", "categoria": "Granitos", "color": "Gris", "espesor_disponible": "2 cm", "precio_m2": 220000, "precio_m2_usd": 185, "moneda": "ARS", "proveedor": "Granitos Arg", "stock_disponible": 40},
    {"nombre": "Silestone Blanco Zeus", "categoria": "Cuarzos", "color": "Blanco", "espesor_disponible": "1.2 cm", "precio_m2": 320000, "precio_m2_usd": 265, "moneda": "USD", "proveedor": "Silestone", "stock_disponible": 20},
    {"nombre": "Silestone Negro Stellar", "categoria": "Cuarzos", "color": "Negro", "espesor_disponible": "1.2 cm", "precio_m2": 350000, "precio_m2_usd": 290, "moneda": "USD", "proveedor": "Silestone", "stock_disponible": 15},
    {"nombre": "Dekton Aura", "categoria": "Sinterizados", "color": "Gris claro", "espesor_disponible": "0.8 cm", "precio_m2": 480000, "precio_m2_usd": 400, "moneda": "USD", "proveedor": "Dekton", "stock_disponible": 10},
    {"nombre": "Dekton XGloss", "categoria": "Sinterizados", "color": "Blanco", "espesor_disponible": "0.8 cm", "precio_m2": 520000, "precio_m2_usd": 435, "moneda": "USD", "proveedor": "Dekton", "stock_disponible": 8},
    {"nombre": "Mármol Travertino", "categoria": "Mármoles", "color": "Beige", "espesor_disponible": "2 cm", "precio_m2": 190000, "precio_m2_usd": 160, "moneda": "ARS", "proveedor": "Marmolera SA", "stock_disponible": 25},
    {"nombre": "Mármol Carrara", "categoria": "Mármoles", "color": "Blanco vetas grises", "espesor_disponible": "2 cm", "precio_m2": 280000, "precio_m2_usd": 235, "moneda": "USD", "proveedor": "Mármoles Italia", "stock_disponible": 12},
    {"nombre": "Neolith Calacatta", "categoria": "Sinterizados", "color": "Blanco vetas", "espesor_disponible": "0.8 cm", "precio_m2": 550000, "precio_m2_usd": 460, "moneda": "USD", "proveedor": "Neolith", "stock_disponible": 5},
]

# Clientes
clientes = [
    {"nombre": "Juan Pérez", "telefono": "221 555-0101", "email": "juan@email.com", "direccion": "Calle 50 1234, La Plata"},
    {"nombre": "María García", "telefono": "221 555-0102", "email": "maria@email.com", "direccion": "Av 7 567, La Plata"},
    {"nombre": "Carlos López", "telefono": "221 555-0103", "email": "carlos@email.com", "direccion": "Calle 8 890, City Bell"},
    {"nombre": "Ana Martínez", "telefono": "221 555-0104", "email": "ana@email.com", "direccion": "Calle 12 345, Gonnet"},
    {"nombre": "Pedro Sánchez", "telefono": "221 555-0105", "email": "pedro@email.com", "direccion": "Av 1 678, Tolosa"},
    {"nombre": "Construcciones SRG", "telefono": "221 555-0201", "email": "info@srg.com", "direccion": "Calle 40 222, La Plata"},
]

# Piletas
piletas = [
    {"marca": "BachaRedonda", "modelo": "Br40", "cantidad": 5, "precio": 45000},
    {"marca": "BachaRedonda", "modelo": "Br50", "cantidad": 3, "precio": 55000},
    {"marca": "BachaCuadrada", "modelo": "Bc40x40", "cantidad": 4, "precio": 60000},
    {"marca": "BachaRectangular", "modelo": "Br35x50", "cantidad": 2, "precio": 75000},
    {"marca": "PiletaApoyo", "modelo": "Pa60", "cantidad": 3, "precio": 85000},
]

print("=== Creando materiales ===")
post_list("/materiales/", materiales)
print("\n=== Creando clientes ===")
post_list("/clientes/", clientes)
print("\n=== Creando piletas ===")
post_list("/stock-piletas/", piletas)
print("\n¡Datos de prueba creados!")
