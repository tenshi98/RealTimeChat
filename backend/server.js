/*
* Servidor principal del chat en tiempo real
* Maneja conexiones HTTP y WebSocket
*/

const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const WebSocket = require('ws');

const config         = require('./config');
const logger         = require('./logger');
const clientsManager = require('./clients');
const chatController = require('./chatController');

class ChatServer {
  constructor() {
    this.httpServer = null;
    this.wss        = null;
  }

  /*
  *============================================================
  * Inicia el servidor HTTP y WebSocket
  */
  start() {
    // Crear servidor HTTP
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // Crear servidor WebSocket
    this.wss = new WebSocket.Server({
      server: this.httpServer,
      path: config.WS_PATH
    });

    // Configurar eventos WebSocket
    this.setupWebSocketEvents();

    // Iniciar servidor
    this.httpServer.listen(config.PORT, () => {
      logger.serverStart(config.PORT);
      console.log(`[INFO] Servidor HTTP escuchando en http://${config.HOST}:${config.PORT}`);
      console.log(`[INFO] Servidor WebSocket iniciado en ws://${config.HOST}:${config.PORT}`);
    });

    // Configurar limpieza periódica
    this.startPeriodicCleanup();

    // Manejar cierre del servidor
    this.setupGracefulShutdown();
  }

  /*
  *============================================================
  * Maneja peticiones HTTP (para servir archivos estáticos)
  */
  handleHttpRequest(req, res) {
    logger.info(`HTTP ${req.method} ${req.url} - ${req.socket.remoteAddress}`);

    // Ruta para servir el frontend
    let filePath = path.join(__dirname, '..', 'frontend', req.url === '/' ? 'index.html' : req.url);

    // Obtener extensión del archivo
    const extname   = path.extname(filePath);
    let contentType = 'text/html';

    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    contentType = mimeTypes[extname] || 'text/plain';

    // Leer y servir archivo
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 - Archivo no encontrado</h1>', 'utf-8');
        } else {
          res.writeHead(500);
          res.end(`Error del servidor: ${error.code}`, 'utf-8');
        }
        logger.error(`Error sirviendo archivo ${filePath}`, error);
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }

  /*
  *============================================================
  * Configura los eventos del servidor WebSocket
  */
  setupWebSocketEvents() {
    this.wss.on('connection', (ws, request) => {
      // Agregar cliente al gestor
      const clientId = clientsManager.addClient(ws, request);

      // Enviar confirmación de conexión
      clientsManager.sendToClient(clientId, {
        type: 'connection',
        message: config.MESSAGES.CONNECTION_SUCCESS,
        clientId: clientId,
        timestamp: Date.now()
      });

      // Configurar eventos del cliente
      this.setupClientEvents(ws, clientId);
    });

    this.wss.on('error', (error) => {
      logger.error('Error en servidor WebSocket', error);
    });

    logger.info('Eventos WebSocket configurados');
  }

  /*
  *============================================================
  * Configura eventos para un cliente específico
  */
  setupClientEvents(ws, clientId) {
    // Evento: mensaje recibido
    ws.on('message', (data) => {
      chatController.handleMessage(clientId, data.toString());
    });

    // Evento: error en la conexión
    ws.on('error', (error) => {
      chatController.handleError(clientId, error);
    });

    // Evento: cliente desconectado
    ws.on('close', (code, reason) => {
      chatController.handleDisconnect(clientId, code, reason.toString());
    });

    // Configurar ping/pong para keepalive
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  /*
  *============================================================
  * Inicia limpieza periódica de conexiones muertas
  */
  startPeriodicCleanup() {
    // Cleanup cada 30 segundos
    this.cleanupInterval = setInterval(() => {
      // Ping a todos los clientes
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });

      // Limpieza de clientes muertos
      clientsManager.cleanupDeadConnections();
    }, 30000);

    logger.info('Limpieza periódica iniciada');
  }

  /*
  *============================================================
  * Configura el cierre limpio del servidor
  */
  setupGracefulShutdown() {
    const shutdown = () => {
      logger.info('Señal de cierre recibida, cerrando servidor...');

      // Detener intervalos
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }

      // Cerrar todas las conexiones WebSocket
      this.wss.clients.forEach((ws) => {
        ws.close(1000, 'Servidor cerrando');
      });

      // Cerrar servidor HTTP
      this.httpServer.close(() => {
        logger.serverStop();
        console.log('[INFO] Servidor cerrado correctamente');
        process.exit(0);
      });

      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('Cierre forzado del servidor');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /*
  *============================================================
  * Obtiene estadísticas del servidor
  */
  getStats() {
    return {
      uptime: process.uptime(),
      connections: this.wss.clients.size,
      chat: chatController.getStats()
    };
  }
}

// Crear e iniciar servidor
const server = new ChatServer();
server.start();

// Exportar para testing
module.exports = server;