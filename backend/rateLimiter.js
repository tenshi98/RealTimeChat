/*
*============================================================
* Control de tasa de mensajes (Rate Limiting)
* Previene spam limitando mensajes por minuto por usuario/IP
*/

const config = require('./config');
const logger = require('./logger');

class RateLimiter {
  constructor() {
    // Mapa para trackear mensajes: { identifier: [timestamp1, timestamp2, ...] }
    this.messageTracking = new Map();

    // Limpieza periódica de datos antiguos cada 5 minutos
    this.startCleanupInterval();
  }

  /*
  *============================================================
  * Obtiene un identificador único del cliente
  * Prioriza IP, pero usa clientId como fallback
  */
  getClientIdentifier(clientId, ip) {
    return ip && ip !== 'unknown' ? `ip:${ip}` : `client:${clientId}`;
  }

  /*
  *============================================================
  * Verifica si el cliente puede enviar un mensaje
  * @returns {Object} { allowed: boolean, remaining: number, resetIn: number }
  */
  checkLimit(clientId, ip = null, username = 'Anónimo') {
    const identifier  = this.getClientIdentifier(clientId, ip);
    const now         = Date.now();
    const windowStart = now - config.RATE_LIMIT_WINDOW;

    // Obtener timestamps de mensajes previos
    let timestamps = this.messageTracking.get(identifier) || [];

    // Filtrar solo los timestamps dentro de la ventana de tiempo
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Verificar si excede el límite
    if (timestamps.length >= config.MAX_MESSAGES_PER_MINUTE) {
      const oldestTimestamp = timestamps[0];
      const resetIn         = Math.ceil((oldestTimestamp + config.RATE_LIMIT_WINDOW - now) / 1000);

      logger.rateLimitExceeded(clientId, username, ip);

      return {
        allowed: false,
        remaining: 0,
        resetIn: resetIn,
        message: `Límite excedido. Espera ${resetIn} segundos.`
      };
    }

    // Agregar el nuevo timestamp
    timestamps.push(now);
    this.messageTracking.set(identifier, timestamps);

    return {
      allowed: true,
      remaining: config.MAX_MESSAGES_PER_MINUTE - timestamps.length,
      resetIn: Math.ceil(config.RATE_LIMIT_WINDOW / 1000),
      message: null
    };
  }

  /*
  *============================================================
  * Resetea el contador de mensajes para un cliente
  * Útil para casos especiales o testing
  */
  resetClient(clientId, ip = null) {
    const identifier = this.getClientIdentifier(clientId, ip);
    this.messageTracking.delete(identifier);
    logger.info(`Rate limit reseteado para: ${identifier}`);
  }

  /*
  *============================================================
  * Obtiene estadísticas de un cliente
  */
  getClientStats(clientId, ip = null) {
    const identifier  = this.getClientIdentifier(clientId, ip);
    const now         = Date.now();
    const windowStart = now - config.RATE_LIMIT_WINDOW;

    let timestamps = this.messageTracking.get(identifier) || [];
    timestamps     = timestamps.filter(ts => ts > windowStart);

    return {
      identifier,
      messagesSent: timestamps.length,
      limit: config.MAX_MESSAGES_PER_MINUTE,
      remaining: config.MAX_MESSAGES_PER_MINUTE - timestamps.length,
      windowSeconds: config.RATE_LIMIT_WINDOW / 1000
    };
  }

  /*
  *============================================================
  * Limpia datos antiguos del mapa
  * Se ejecuta periódicamente para evitar fugas de memoria
  */
  cleanup() {
    const now         = Date.now();
    const windowStart = now - config.RATE_LIMIT_WINDOW;
    let cleanedCount  = 0;

    for (const [identifier, timestamps] of this.messageTracking.entries()) {
      const validTimestamps = timestamps.filter(ts => ts > windowStart);

      if (validTimestamps.length === 0) {
        // Si no hay timestamps válidos, eliminar la entrada
        this.messageTracking.delete(identifier);
        cleanedCount++;
      } else if (validTimestamps.length < timestamps.length) {
        // Si hay algunos timestamps válidos, actualizar
        this.messageTracking.set(identifier, validTimestamps);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Rate limiter cleanup: ${cleanedCount} entradas eliminadas`);
    }
  }

  /*
  *============================================================
  * Inicia el intervalo de limpieza automática
  */
  startCleanupInterval() {
    // Limpieza cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('Rate limiter: intervalo de limpieza iniciado');
  }

  /*
  *============================================================
  * Detiene el intervalo de limpieza
  */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Rate limiter: intervalo de limpieza detenido');
    }
  }

  /*
  *============================================================
  * Obtiene estadísticas globales
  */
  getGlobalStats() {
    return {
      totalClients: this.messageTracking.size,
      maxMessagesPerMinute: config.MAX_MESSAGES_PER_MINUTE,
      windowSeconds: config.RATE_LIMIT_WINDOW / 1000
    };
  }
}

// Exportar instancia única (Singleton)
module.exports = new RateLimiter();