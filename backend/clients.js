/*
*============================================================
* Gestor de clientes conectados al servidor WebSocket
* Mantiene el registro de todos los usuarios activos
*/

const logger = require('./logger');

class ClientsManager {
  constructor() {
    // Mapa de clientes: clientId -> { ws, username, ip, connectedAt }
    this.clients = new Map();
  }

  /*
  *============================================================
  * Genera un ID único para cada cliente
  */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /*
  *============================================================
  * Obtiene la IP del cliente desde la request
  */
  getClientIp(request) {
    // Intenta obtener la IP real considerando proxies
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fallback a la IP de la conexión
    return request.socket.remoteAddress || 'unknown';
  }

  /*
  *============================================================
  * Agrega un nuevo cliente
  */
  addClient(ws, request) {
    const clientId = this.generateClientId();
    const ip       = this.getClientIp(request);

    const client = {
      id: clientId,
      ws: ws,
      username: null, // Se establece cuando el usuario se une al chat
      ip: ip,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.clients.set(clientId, client);
    logger.connection(clientId, 'Anónimo', ip);

    return clientId;
  }

  /*
  *============================================================
  * Remueve un cliente
  */
  removeClient(clientId) {
    const client = this.clients.get(clientId);

    if (client) {
      const username = client.username || 'Anónimo';
      logger.disconnection(clientId, username);
      this.clients.delete(clientId);
      return client;
    }

    return null;
  }

  /*
  *============================================================
  * Obtiene un cliente por su ID
  */
  getClient(clientId) {
    return this.clients.get(clientId);
  }

  /*
  *============================================================
  * Busca un cliente por nombre de usuario
  */
  getClientByUsername(username) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.username === username) {
        return { clientId, ...client };
      }
    }
    return null;
  }

  /*
  *============================================================
  * Actualiza el nombre de usuario de un cliente
  */
  setUsername(clientId, username) {
    const client = this.clients.get(clientId);

    if (client) {
      const oldUsername   = client.username;
      client.username     = username;
      client.lastActivity = Date.now();

      logger.info(`Usuario ${oldUsername || 'Anónimo'} cambió nombre a: ${username} (ID: ${clientId})`);
      return true;
    }

    return false;
  }

  /*
  *============================================================
  * Verifica si un nombre de usuario ya está en uso
  */
  isUsernameTaken(username) {
    for (const client of this.clients.values()) {
      if (client.username === username) {
        return true;
      }
    }
    return false;
  }

  /*
  *============================================================
  * Actualiza la última actividad del cliente
  */
  updateActivity(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  /*
  *============================================================
  * Obtiene todos los clientes conectados
  */
  getAllClients() {
    return Array.from(this.clients.entries()).map(([id, client]) => ({
      id,
      username: client.username,
      ip: client.ip,
      connectedAt: client.connectedAt,
      lastActivity: client.lastActivity
    }));
  }

  /*
  *============================================================
  * Obtiene la lista de usuarios activos (con nombre)
  */
  getActiveUsers() {
    const users = [];

    for (const client of this.clients.values()) {
      if (client.username) {
        users.push({
          username: client.username,
          connectedAt: client.connectedAt
        });
      }
    }

    return users;
  }

  /*
  *============================================================
  * Obtiene el número total de clientes conectados
  */
  getClientCount() {
    return this.clients.size;
  }

  /*
  *============================================================
  * Obtiene el número de usuarios con nombre (activos en el chat)
  */
  getActiveUserCount() {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.username) {
        count++;
      }
    }
    return count;
  }

  /*
  *============================================================
  * Envía un mensaje a un cliente específico
  */
  sendToClient(clientId, data) {
    const client = this.clients.get(clientId);

    if (client && client.ws && client.ws.readyState === 1) { // 1 = OPEN
      try {
        client.ws.send(JSON.stringify(data));
        return true;
      } catch (error) {
        logger.error(`Error enviando mensaje a cliente ${clientId}`, error);
        return false;
      }
    }

    return false;
  }

  /*
  *============================================================
  * Hace broadcast de un mensaje a todos los clientes
  */
  broadcast(data, excludeClientId = null) {
    const message    = JSON.stringify(data);
    let successCount = 0;
    let failCount    = 0;

    for (const [clientId, client] of this.clients.entries()) {
      // Excluir cliente si se especifica
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      if (client.ws && client.ws.readyState === 1) {
        try {
          client.ws.send(message);
          successCount++;
        } catch (error) {
          logger.error(`Error en broadcast a cliente ${clientId}`, error);
          failCount++;
        }
      }
    }

    logger.info(`Broadcast completado: ${successCount} exitosos, ${failCount} fallidos`);
    return { successCount, failCount };
  }

  /*
  *============================================================
  * Hace broadcast solo a usuarios activos (con nombre de usuario)
  */
  broadcastToActiveUsers(data, excludeClientId = null) {
    const message    = JSON.stringify(data);
    let successCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (!client.username) continue; // Solo usuarios con nombre
      if (excludeClientId && clientId === excludeClientId) continue;

      if (client.ws && client.ws.readyState === 1) {
        try {
          client.ws.send(message);
          successCount++;
        } catch (error) {
          logger.error(`Error en broadcast a ${client.username}`, error);
        }
      }
    }

    return successCount;
  }

  /*
  *============================================================
  * Limpia conexiones muertas o inactivas
  */
  cleanupDeadConnections() {
    const now         = Date.now();
    const timeout     = 5 * 60 * 1000; // 5 minutos de inactividad
    const deadClients = [];

    for (const [clientId, client] of this.clients.entries()) {
      const isInactive = (now - client.lastActivity) > timeout;
      const isClosed   = !client.ws || client.ws.readyState !== 1;

      if (isInactive || isClosed) {
        deadClients.push(clientId);
      }
    }

    // Remover clientes muertos
    deadClients.forEach(clientId => {
      logger.warning(`Limpiando conexión muerta: ${clientId}`);
      this.removeClient(clientId);
    });

    if (deadClients.length > 0) {
      logger.info(`Cleanup completado: ${deadClients.length} conexiones removidas`);
    }

    return deadClients.length;
  }

  /*
  *============================================================
  * Obtiene estadísticas del gestor de clientes
  */
  getStats() {
    return {
      totalClients: this.getClientCount(),
      activeUsers: this.getActiveUserCount(),
      anonymousClients: this.getClientCount() - this.getActiveUserCount()
    };
  }
}

// Exportar instancia única (Singleton)
module.exports = new ClientsManager();