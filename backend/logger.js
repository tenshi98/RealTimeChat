/*
*============================================================
* Sistema de logging para registrar eventos del servidor
* Categorías: info, warnings, errores, conversaciones
*/

const fs     = require('fs');
const path   = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logDir = config.LOG_DIRECTORY;
    this.ensureLogDirectory();
  }

  /*
  *============================================================
  * Asegura que el directorio de logs existe
  */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
        console.log(`[LOGGER] Directorio de logs creado: ${this.logDir}`);
      } catch (error) {
        console.error(`[LOGGER ERROR] No se pudo crear directorio de logs: ${error.message}`);
      }
    }
  }

  /*
  *============================================================
  * Formatea el timestamp para los logs
  */
  getTimestamp() {
    const now     = new Date();
    const year    = now.getFullYear();
    const month   = String(now.getMonth() + 1).padStart(2, '0');
    const day     = String(now.getDate()).padStart(2, '0');
    const hours   = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /*
  *============================================================
  * Escribe en un archivo de log específico
  */
  writeToFile(filename, message) {
    const filePath   = path.join(this.logDir, filename);
    const logMessage = `[${this.getTimestamp()}] ${message}\n`;

    try {
      fs.appendFileSync(filePath, logMessage, 'utf8');
    } catch (error) {
      console.error(`[LOGGER ERROR] No se pudo escribir en ${filename}: ${error.message}`);
    }
  }

  /*
  *============================================================
  * Registra información general
  */
  info(message) {
    const logMessage = `[INFO] ${message}`;
    console.log(logMessage);
    this.writeToFile(config.LOG_INFO, logMessage);
  }

  /*
  *============================================================
  * Registra advertencias
  */
  warning(message) {
    const logMessage = `[WARNING] ${message}`;
    console.warn(logMessage);
    this.writeToFile(config.LOG_WARNINGS, logMessage);
  }

  /*
  *============================================================
  * Registra errores
  */
  error(message, errorObj = null) {
    let logMessage = `[ERROR] ${message}`;

    if (errorObj) {
      logMessage += `\n  Stack: ${errorObj.stack || errorObj.message || errorObj}`;
    }

    console.error(logMessage);
    this.writeToFile(config.LOG_ERRORS, logMessage);
  }

  /*
  *============================================================
  * Registra mensajes del chat (conversaciones)
  */
  conversation(username, message) {
    const logMessage = `[CONVERSATION] ${username}: ${message}`;
    this.writeToFile(config.LOG_CONVERSATIONS, logMessage);
  }

  /*
  *============================================================
  * Registra eventos de conexión
  */
  connection(clientId, username = 'Anónimo', ip = 'unknown') {
    const message = `Usuario conectado: ${username} (ID: ${clientId}, IP: ${ip})`;
    this.info(message);
  }

  /*
  *============================================================
  * Registra eventos de desconexión
  */
  disconnection(clientId, username = 'Anónimo', reason = 'unknown') {
    const message = `Usuario desconectado: ${username} (ID: ${clientId}, Razón: ${reason})`;
    this.info(message);
  }

  /*
  *============================================================
  * Registra eventos de rate limiting
  */
  rateLimitExceeded(clientId, username, ip) {
    const message = `Rate limit excedido: ${username} (ID: ${clientId}, IP: ${ip})`;
    this.warning(message);
  }

  /*
  *============================================================
  * Registra errores de validación
  */
  validationError(clientId, error, data) {
    const message = `Error de validación: ${error} (ID: ${clientId}, Data: ${JSON.stringify(data)})`;
    this.warning(message);
  }

  /*
  *============================================================
  * Registra el inicio del servidor
  */
  serverStart(port) {
    const message = `Servidor iniciado en puerto ${port}`;
    this.info(message);
    this.info('='.repeat(50));
  }

  /*
  *============================================================
  * Registra el cierre del servidor
  */
  serverStop() {
    this.info('='.repeat(50));
    this.info('Servidor detenido');
  }
}

// Exportar instancia única del logger (Singleton)
module.exports = new Logger();