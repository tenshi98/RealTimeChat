# Chat en Tiempo Real con WebSocket

Sistema de chat en tiempo real implementado con WebSocket puro, Node.js (sin frameworks) y JavaScript vanilla.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Cómo Ejecutar el Proyecto](#-cómo-ejecutar-el-proyecto)
- [Ejemplos de Uso](#-ejemplos-de-uso)
- [Arquitectura y Módulos](#-arquitectura-y-módulos)
- [Solución de Problemas](#-solución-de-problemas)
- [Monitoreo y Logs](#-monitoreo-y-logs)

## 📋 Características

- ✅ Comunicación bidireccional en tiempo real
- ✅ Broadcast de mensajes a todos los usuarios conectados
- ✅ Sistema de control de conexiones (rate limiting)
- ✅ Gestión automática de usuarios activos
- ✅ Detección de desconexiones
- ✅ Sistema de logging completo (info, warnings, errores, conversaciones)
- ✅ Interfaz responsiva sin frameworks
- ✅ Identificación de usuarios por nombre
- ✅ Lista de usuarios activos en tiempo real
- ✅ Manejo robusto de errores

## 🔧 Requisitos

- Node.js v14 o superior
- Navegador web moderno con soporte para WebSocket
- Puerto 8080 disponible (configurable)

## 📁 Estructura del Proyecto

```
RealTimeChat/
│
├── backend/
│   ├── server.js              # Servidor principal HTTP y WebSocket
│   ├── clients.js             # Gestión de clientes conectados
│   ├── chatController.js      # Lógica del chat y mensajes
│   ├── logger.js              # Sistema de logging
│   ├── rateLimiter.js         # Control de rate limiting
│   ├── config.js              # Configuración centralizada
│   └── logs/                  # Carpeta de logs (se crea automáticamente)
│       ├── info.log
│       ├── warnings.log
│       ├── errors.log
│       └── conversations.log
│
└── frontend/
    ├── index.html             # Estructura HTML
    ├── styles.css             # Estilos de la interfaz
    └── app.js                 # Lógica del cliente WebSocket
```

## 🚀 Instalación

### 1. Clonar o crear la estructura del proyecto

```bash
git clone https://github.com/tenshi98/RealTimeChat.git
cd RealTimeChat
cd backend
mkdir logs
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm init -y
npm install ws
```

## ⚙️ Configuración

### Backend - config.js

Modifica las constantes según tus necesidades:

```javascript
PORT: 8080,                    // Puerto del servidor
MAX_MESSAGES_PER_MINUTE: 10,  // Mensajes máximos por minuto
MESSAGE_DELAY: 100,            // Delay entre mensajes (ms)
MAX_MESSAGE_LENGTH: 500,       // Longitud máxima de mensaje
```

### Frontend - app.js

Ajusta la URL de conexión si es necesario:

```javascript
const socket = new WebSocket('ws://localhost:8080');
```

## 🎯 Cómo Ejecutar el Proyecto

### Paso 1: Iniciar el Backend

```bash
cd backend
node server.js
```

Deberías ver:
```
[INFO] Servidor HTTP escuchando en http://localhost:8080
[INFO] Servidor WebSocket iniciado en ws://localhost:8080
```

### Paso 2: Abrir el Frontend

Opción A - Abrir directamente el HTML:
```bash
cd frontend
# Abrir index.html en el navegador
```

Opción B - Usar un servidor HTTP simple (recomendado):
```bash
cd frontend
npx http-server -p 3000
# Abrir http://localhost:3000 en el navegador
```

Opción C - Usar Python:
```bash
cd frontend
python -m http.server 3000
# Abrir http://localhost:3000 en el navegador
```

### Paso 3: Probar el Chat

1. Abre múltiples pestañas del navegador
2. Ingresa diferentes nombres de usuario
3. Envía mensajes y observa la comunicación en tiempo real
4. Verifica la lista de usuarios activos
5. Cierra pestañas para ver cómo se actualiza la lista

## 📝 Ejemplos de Uso

### Flujo Básico de Comunicación

1. **Conexión del Cliente:**
```javascript
Cliente → Servidor: Conexión WebSocket
Servidor → Cliente: { type: 'connection', message: 'Conectado al servidor' }
```

2. **Unirse al Chat:**
```javascript
Cliente → Servidor: { type: 'join', username: 'Juan' }
Servidor → Todos: { type: 'userJoined', username: 'Juan', users: [...] }
```

3. **Enviar Mensaje:**
```javascript
Cliente → Servidor: { type: 'message', content: 'Hola a todos' }
Servidor → Todos: { type: 'message', username: 'Juan', content: 'Hola a todos', timestamp: ... }
```

4. **Desconexión:**
```javascript
Cliente → Servidor: Cierre de conexión
Servidor → Todos: { type: 'userLeft', username: 'Juan', users: [...] }
```

## 🏗️ Arquitectura y Módulos

### Backend

#### server.js
- Servidor HTTP para servir archivos estáticos
- Inicialización del servidor WebSocket
- Manejo de eventos de conexión
- Delegación de lógica al controlador

#### clients.js
- Gestión del mapa de clientes conectados
- Funciones para agregar/eliminar clientes
- Obtención de información de usuarios activos
- Búsqueda de clientes por ID o nombre

#### chatController.js
- Procesamiento de mensajes entrantes
- Validación de datos
- Broadcast de mensajes
- Manejo de eventos del chat (join, message, etc.)

#### rateLimiter.js
- Control de tasa de mensajes por cliente
- Prevención de spam
- Basado en IP del cliente

#### logger.js
- Sistema de logging a archivos
- Categorías: info, warnings, errores, conversaciones
- Timestamps automáticos

#### config.js
- Configuración centralizada
- Constantes del sistema

### Frontend

#### index.html
- Estructura semántica del chat
- Área de mensajes
- Lista de usuarios activos
- Formulario de entrada

#### styles.css
- Diseño responsivo
- Estilos modernos con gradientes
- Animaciones sutiles
- Diferenciación visual de mensajes propios/ajenos

#### app.js
- Conexión WebSocket
- Manejo de eventos del socket
- Renderizado dinámico de mensajes
- Actualización de lista de usuarios
- Gestión del estado local

## 🔄 Flujo WebSocket Detallado

### Establecimiento de Conexión

```
1. Cliente crea WebSocket → new WebSocket('ws://localhost:8080')
2. Servidor acepta conexión → ws.on('connection')
3. Servidor envía confirmación → { type: 'connection' }
4. Cliente recibe confirmación → socket.onmessage
```

### Ciclo de Vida del Mensaje

```
1. Usuario escribe mensaje
2. Frontend valida y envía JSON → socket.send()
3. Backend recibe → ws.on('message')
4. Rate limiter verifica límites
5. ChatController procesa mensaje
6. Logger registra en conversations.log
7. Broadcast a todos los clientes → client.send()
8. Cada cliente recibe y renderiza → socket.onmessage
```

### Manejo de Desconexión

```
1. Cliente cierra conexión o pierde red
2. Servidor detecta → ws.on('close')
3. ClientsManager elimina cliente
4. Broadcast de userLeft a usuarios restantes
5. Logger registra desconexión
```

## 🛡️ Seguridad y Buenas Prácticas

### Implementadas

- ✅ Rate limiting por IP
- ✅ Validación de longitud de mensajes
- ✅ Sanitización básica de entrada
- ✅ Manejo de errores try-catch
- ✅ Cierre limpio de conexiones
- ✅ Logging completo de eventos

### Recomendadas para Producción

- 🔒 Implementar autenticación (JWT)
- 🔒 Usar WSS (WebSocket Secure) con SSL/TLS
- 🔒 Validar y sanitizar todo input del usuario
- 🔒 Implementar límites de conexiones por IP
- 🔒 Agregar persistencia de mensajes (base de datos)
- 🔒 Implementar reconexión automática en cliente
- 🔒 Agregar compresión de mensajes
- 🔒 Implementar heartbeat/ping-pong

## 🐛 Solución de Problemas

### El servidor no inicia

```bash
Error: listen EADDRINUSE :::8080
```
**Solución:** El puerto está en uso. Cambia el puerto en `config.js` o mata el proceso:
```bash
# Linux/Mac
lsof -ti:8080 | xargs kill -9

# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Cliente no se conecta

**Problema:** `WebSocket connection to 'ws://localhost:8080' failed`

**Soluciones:**
1. Verifica que el backend esté corriendo
2. Confirma el puerto correcto en app.js
3. Revisa la consola del navegador para errores
4. Verifica el firewall

### Mensajes no se envían

**Problema:** Rate limit alcanzado

**Solución:** El sistema tiene protección anti-spam. Espera 1 minuto o ajusta `MAX_MESSAGES_PER_MINUTE` en config.js

### No se crean los logs

**Problema:** Carpeta logs/ no existe

**Solución:**
```bash
cd backend
mkdir logs
```

## 📊 Monitoreo y Logs

Los logs se guardan automáticamente en:

- `logs/info.log` - Conexiones, desconexiones, eventos generales
- `logs/warnings.log` - Rate limits, validaciones fallidas
- `logs/errors.log` - Errores del sistema
- `logs/conversations.log` - Todos los mensajes del chat

Formato de log:
```
[2025-12-08 10:30:45] [INFO] Usuario conectado: Juan (ID: abc123)
[2025-12-08 10:30:50] [CONVERSATION] Juan: Hola a todos
```

