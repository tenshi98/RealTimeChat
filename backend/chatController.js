/*
*============================================================
* Controlador principal del chat
* Maneja toda la lógica de mensajes, validaciones y eventos
*/

const config         = require('./config');
const logger         = require('./logger');
const clientsManager = require('./clients');
const rateLimiter    = require('./rateLimiter');

class ChatController {
  constructor() {
    this.messageQueue      = [];
    this.isProcessingQueue = false;
  }

  /*
  *============================================================
  * Valida el formato de un mensaje
  */
  validateMessage(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Formato inválido' };
    }

    if (!data.type) {
      return { valid: false, error: 'Tipo de mensaje no especificado' };
    }

    return { valid: true };
  }

  /*
  *============================================================
  * Valida el contenido de un mensaje de texto
  */
  validateMessageContent(content) {
    if (!content || typeof content !== 'string') {
      return { valid: false, error: 'Contenido inválido' };
    }

    const trimmed = content.trim();

    if (trimmed.length < config.MIN_MESSAGE_LENGTH) {
      return { valid: false, error: config.MESSAGES.MESSAGE_TOO_SHORT };
    }

    if (trimmed.length > config.MAX_MESSAGE_LENGTH) {
      return { valid: false, error: config.MESSAGES.MESSAGE_TOO_LONG };
    }

    return { valid: true, content: trimmed };
  }

  /*
  *============================================================
  * Valida un nombre de usuario
  */
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Nombre de usuario inválido' };
    }

    const trimmed = username.trim();

    if (trimmed.length < config.MIN_USERNAME_LENGTH) {
      return { valid: false, error: `El nombre debe tener al menos ${config.MIN_USERNAME_LENGTH} caracteres` };
    }

    if (trimmed.length > config.MAX_USERNAME_LENGTH) {
      return { valid: false, error: `El nombre no puede exceder ${config.MAX_USERNAME_LENGTH} caracteres` };
    }

    // Validar caracteres permitidos (letras, números, espacios, guiones bajos)
    const validPattern = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s_-]+$/;
    if (!validPattern.test(trimmed)) {
      return { valid: false, error: 'El nombre contiene caracteres no permitidos' };
    }

    return { valid: true, username: trimmed };
  }

  /*
  *============================================================
  * Sanitiza un string para prevenir XSS
  */
  sanitize(str) {
    if (typeof str !== 'string') return str;

    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /*
  *============================================================
  * Maneja un nuevo mensaje entrante
  */
  async handleMessage(clientId, rawData) {
    try {
      // Parsear JSON
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (error) {
        logger.error(`Error parseando JSON de cliente ${clientId}`, error);
        this.sendError(clientId, 'Formato de mensaje inválido');
        return;
      }

      // Validar formato básico
      const validation = this.validateMessage(data);
      if (!validation.valid) {
        logger.validationError(clientId, validation.error, data);
        this.sendError(clientId, validation.error);
        return;
      }

      // Actualizar actividad del cliente
      clientsManager.updateActivity(clientId);

      // Enrutar según tipo de mensaje
      switch (data.type) {
        case 'join':
          await this.handleJoin(clientId, data);
          break;

        case 'message':
          await this.handleChatMessage(clientId, data);
          break;

        case 'ping':
          this.handlePing(clientId);
          break;

        default:
          logger.warning(`Tipo de mensaje desconocido: ${data.type} (cliente: ${clientId})`);
          this.sendError(clientId, 'Tipo de mensaje no soportado');
      }

    } catch (error) {
      logger.error(`Error manejando mensaje de cliente ${clientId}`, error);
      this.sendError(clientId, config.MESSAGES.SERVER_ERROR);
    }
  }

  /*
  *============================================================
  * Maneja el evento de un usuario uniéndose al chat
  */
  async handleJoin(clientId, data) {
    const client = clientsManager.getClient(clientId);
    if (!client) {
      logger.error(`Cliente no encontrado: ${clientId}`);
      return;
    }

    // Validar nombre de usuario
    const validation = this.validateUsername(data.username);
    if (!validation.valid) {
      this.sendError(clientId, validation.error);
      return;
    }

    const username = this.sanitize(validation.username);

    // Verificar si el nombre ya está en uso
    if (clientsManager.isUsernameTaken(username)) {
      this.sendError(clientId, config.MESSAGES.USERNAME_TAKEN);
      return;
    }

    // Establecer nombre de usuario
    clientsManager.setUsername(clientId, username);

    // Notificar al usuario que se unió exitosamente
    clientsManager.sendToClient(clientId, {
      type: 'joined',
      username: username,
      message: 'Te has unido al chat exitosamente',
      users: clientsManager.getActiveUsers()
    });

    // Notificar a todos los demás usuarios
    clientsManager.broadcast({
      type: 'userJoined',
      username: username,
      message: `${username} ${config.MESSAGES.USER_JOINED}`,
      timestamp: Date.now(),
      users: clientsManager.getActiveUsers()
    }, clientId);

    logger.info(`${username} se unió al chat (ID: ${clientId})`);
  }

  /*
  *============================================================
  * Maneja un mensaje de chat
  */
  async handleChatMessage(clientId, data) {
    const client = clientsManager.getClient(clientId);
    if (!client) {
      logger.error(`Cliente no encontrado: ${clientId}`);
      return;
    }

    // Verificar que el usuario tenga nombre (esté registrado)
    if (!client.username) {
      this.sendError(clientId, 'Debes unirte al chat primero');
      return;
    }

    // Validar contenido del mensaje
    const validation = this.validateMessageContent(data.content);
    if (!validation.valid) {
      this.sendError(clientId, validation.error);
      return;
    }

    const content = this.sanitize(validation.content);

    // Verificar rate limit
    const rateCheck = rateLimiter.checkLimit(clientId, client.ip, client.username);
    if (!rateCheck.allowed) {
      this.sendError(clientId, rateCheck.message);
      return;
    }

    // Agregar mensaje a la cola para procesamiento con delay
    this.queueMessage({
      clientId,
      username: client.username,
      content,
      timestamp: Date.now()
    });

    // Log del mensaje
    logger.conversation(client.username, content);
  }

  /*
  *============================================================
  * Cola de mensajes con delay artificial
  */
  queueMessage(message) {
    this.messageQueue.push(message);

    if (!this.isProcessingQueue) {
      this.processMessageQueue();
    }
  }

  /*
  *============================================================
  * Procesa la cola de mensajes con delays
  */
  async processMessageQueue() {
    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();

      // Broadcast del mensaje a todos los usuarios
      clientsManager.broadcast({
        type: 'message',
        username: message.username,
        content: message.content,
        timestamp: message.timestamp
      });

      // Delay artificial entre mensajes
      if (this.messageQueue.length > 0 && config.MESSAGE_DELAY > 0) {
        await this.sleep(config.MESSAGE_DELAY);
      }
    }

    this.isProcessingQueue = false;
  }

  /*
  *============================================================
  * Maneja ping del cliente
  */
  handlePing(clientId) {
    clientsManager.sendToClient(clientId, {
      type: 'pong',
      timestamp: Date.now()
    });
  }

  /*
  *============================================================
  * Maneja la desconexión de un cliente
  */
  handleDisconnect(clientId, code, reason) {
    const client = clientsManager.getClient(clientId);

    if (client && client.username) {
      // Notificar a todos que el usuario se fue
      clientsManager.broadcast({
        type: 'userLeft',
        username: client.username,
        message: `${client.username} ${config.MESSAGES.USER_LEFT}`,
        timestamp: Date.now(),
        users: clientsManager.getActiveUsers().filter(u => u.username !== client.username)
      });
    }

    // Remover cliente del gestor
    clientsManager.removeClient(clientId);

    logger.disconnection(clientId, client?.username || 'Anónimo', reason || code || 'unknown');
  }

  /*
  *============================================================
  * Maneja errores de conexión
  */
  handleError(clientId, error) {
    logger.error(`Error en cliente ${clientId}`, error);

    const client = clientsManager.getClient(clientId);
    if (client) {
      this.sendError(clientId, config.MESSAGES.SERVER_ERROR);
    }
  }

  /*
  *============================================================
  * Envía un mensaje de error a un cliente
  */
  sendError(clientId, message) {
    clientsManager.sendToClient(clientId, {
      type: 'error',
      message: message,
      timestamp: Date.now()
    });
  }

  /*
  *============================================================
  * Obtiene estadísticas del chat
  */
  getStats() {
    return {
      clients: clientsManager.getStats(),
      rateLimiter: rateLimiter.getGlobalStats(),
      messageQueue: this.messageQueue.length
    };
  }

  /*
  *============================================================
  * Utility: sleep function
  */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar instancia única (Singleton)
module.exports = new ChatController();